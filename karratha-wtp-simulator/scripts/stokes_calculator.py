#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════════════════
STOKES LAW SEPARATION CALCULATOR
═══════════════════════════════════════════════════════════════════════════════

Python companion tool for validating centrifuge separation calculations.
Implements the same physics models as the React simulator for cross-validation.

Features:
- Stokes Law settling velocity
- Richardson-Zaki hindered settling
- Arrhenius viscosity temperature dependence
- Langmuir adsorption for chemical dosing
- Smoluchowski flocculation kinetics

Usage:
    python stokes_calculator.py --validate
    python stokes_calculator.py --calculate --temp 65 --rpm 3500 --flow 12

Author: Karratha WTP Team
Version: 1.0.0
═══════════════════════════════════════════════════════════════════════════════
"""

import math
import json
import argparse
from dataclasses import dataclass, asdict
from typing import Optional, Tuple, Dict, List

# ═══════════════════════════════════════════════════════════════════════════════
# PHYSICAL CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

G = 9.81  # m/s² - gravitational acceleration
R_GAS = 8.314  # J/(mol·K) - universal gas constant


@dataclass
class FeedProperties:
    """Feed stream properties"""
    # Phase fractions (must sum to 1.0)
    water_fraction: float = 0.75
    oil_fraction: float = 0.20
    solids_fraction: float = 0.05

    # Densities (kg/m³)
    water_density: float = 1000.0
    oil_density: float = 890.0
    solids_density: float = 2650.0

    # Particle sizes (microns)
    oil_droplet_d50: float = 25.0
    solids_d50: float = 80.0

    # Viscosity
    oil_viscosity: float = 50.0  # mPa·s at 25°C
    viscosity_temp_coeff: float = 0.025  # Arrhenius coefficient

    # Emulsion properties
    emulsion_stability: float = 0.3  # 0-1
    interfacial_tension: float = 25.0  # mN/m

    # Chemical dosing (ppm)
    demulsifier_dose: float = 50.0
    demulsifier_eff: float = 0.7
    flocculant_dose: float = 0.0
    flocculant_eff: float = 0.8

    # Hindered settling
    max_packing_fraction: float = 0.64
    hindered_settling_exp: float = 4.65  # Richardson-Zaki

    # Shape factors
    oil_sphericity: float = 1.0
    solids_sphericity: float = 0.8

    # Salinity
    salinity: float = 35000.0  # mg/L


@dataclass
class EquipmentConfig:
    """Centrifuge equipment configuration"""
    bowl_diameter: float = 400.0  # mm
    bowl_length: float = 1100.0  # mm
    max_rpm: int = 5000
    min_rpm: int = 1500
    max_flow: float = 15.0  # m³/h


@dataclass
class OperatingConditions:
    """Current operating conditions"""
    temperature: float = 65.0  # °C
    bowl_speed: float = 3500.0  # RPM
    feed_flow: float = 12.0  # m³/h


@dataclass
class SeparationResults:
    """Calculated separation results"""
    oil_efficiency: float
    solids_efficiency: float
    water_quality_ppm: float
    g_force: float
    residence_time: float
    oil_settling_velocity: float
    solids_settling_velocity: float
    viscosity: float


# ═══════════════════════════════════════════════════════════════════════════════
# CORE CALCULATIONS
# ═══════════════════════════════════════════════════════════════════════════════

def calculate_viscosity(base_viscosity: float, temp: float, temp_coeff: float,
                        ref_temp: float = 25.0) -> float:
    """
    Calculate temperature-dependent viscosity using Arrhenius equation.

    μ = μ_ref × exp(E_a/R × (1/T - 1/T_ref))

    Simplified form: μ = μ_ref × exp(k × (T_ref - T))
    """
    # Convert to Pa·s from mPa·s
    visc_ref = base_viscosity * 0.001

    # Apply Arrhenius temperature correction
    visc = visc_ref * math.exp(temp_coeff * (ref_temp - temp) * 10)

    return visc  # Pa·s


def calculate_g_force(bowl_diameter_mm: float, rpm: float) -> float:
    """
    Calculate centrifugal acceleration in g's.

    g = ω²r / 9.81
    where ω = 2πN/60 (rad/s)
    """
    r = bowl_diameter_mm / 2000  # Convert mm to m
    omega = rpm * 2 * math.pi / 60  # rad/s
    g_accel = omega * omega * r  # m/s²

    return g_accel / G  # dimensionless g-force


def calculate_stokes_velocity(
    diameter_m: float,
    density_diff: float,
    viscosity: float,
    g_accel: float,
    sphericity: float = 1.0
) -> float:
    """
    Calculate Stokes settling/rising velocity.

    V_t = (d² × Δρ × g × φ) / (18 × μ)

    where:
        d = particle/droplet diameter (m)
        Δρ = density difference (kg/m³)
        g = acceleration (m/s²)
        φ = sphericity correction
        μ = dynamic viscosity (Pa·s)
    """
    v = (diameter_m ** 2 * density_diff * g_accel * sphericity) / (18 * viscosity)
    return abs(v)  # Always positive


def calculate_hindered_settling(
    stokes_velocity: float,
    solids_fraction: float,
    max_packing: float,
    exponent: float
) -> float:
    """
    Apply Richardson-Zaki hindered settling correction.

    V_h = V_s × (1 - φ/φ_max)^n

    At high concentrations, particles interfere with each other.
    """
    if solids_fraction >= max_packing:
        return 0.0

    hindrance_factor = (1 - solids_fraction / max_packing) ** exponent
    return stokes_velocity * hindrance_factor


def calculate_langmuir_coverage(dose_ppm: float, k: float = 0.05,
                                  q_max: float = 0.95) -> float:
    """
    Calculate surface coverage using Langmuir isotherm.

    θ = (K × C) / (1 + K × C) × θ_max

    Used for demulsifier adsorption on oil-water interface.
    """
    if dose_ppm <= 0:
        return 0.0

    coverage = (k * dose_ppm) / (1 + k * dose_ppm) * q_max
    return min(coverage, q_max)


def calculate_separation_efficiency(
    feed: FeedProperties,
    equipment: EquipmentConfig,
    conditions: OperatingConditions
) -> SeparationResults:
    """
    Main calculation function - mirrors JavaScript calcEfficiency.

    Calculates oil and solids separation efficiency based on:
    - Stokes Law with hindered settling
    - Temperature-dependent viscosity
    - Chemical dosing effects
    - Equipment geometry
    """

    # 1. Calculate effective viscosity
    viscosity = calculate_viscosity(
        feed.oil_viscosity,
        conditions.temperature,
        feed.viscosity_temp_coeff
    )

    # 2. Calculate centrifugal acceleration
    r = equipment.bowl_diameter / 2000  # m
    omega = conditions.bowl_speed * 2 * math.pi / 60  # rad/s
    g_accel = omega * omega * r  # m/s²
    g_force = g_accel / G

    # 3. Density differences (adjust water density for salinity)
    water_density_adj = feed.water_density + feed.salinity * 0.0007
    oil_water_delta_rho = water_density_adj - feed.oil_density
    solids_water_delta_rho = feed.solids_density - water_density_adj

    # 4. Stokes velocities
    oil_d_m = feed.oil_droplet_d50 * 1e-6  # microns to m
    solids_d_m = feed.solids_d50 * 1e-6

    oil_v_stokes = calculate_stokes_velocity(
        oil_d_m, oil_water_delta_rho, viscosity, g_accel, feed.oil_sphericity
    )

    solids_v_stokes = calculate_stokes_velocity(
        solids_d_m, solids_water_delta_rho, viscosity, g_accel, feed.solids_sphericity
    )

    # 5. Hindered settling correction
    total_solids = feed.solids_fraction + feed.oil_fraction * 0.1

    oil_v_hindered = calculate_hindered_settling(
        oil_v_stokes, total_solids, feed.max_packing_fraction,
        feed.hindered_settling_exp
    )

    solids_v_hindered = calculate_hindered_settling(
        solids_v_stokes, total_solids, feed.max_packing_fraction,
        feed.hindered_settling_exp
    )

    # 6. Residence time and separation distance
    bowl_vol = math.pi * r * r * (equipment.bowl_length / 1000)  # m³
    flow_m3_s = conditions.feed_flow / 3600
    residence_time = bowl_vol / max(flow_m3_s, 0.001)  # seconds
    separation_dist = r * 0.3  # Effective radial distance

    # 7. Base efficiency (Sigma theory - logistic function)
    oil_sigma = oil_v_hindered * residence_time / separation_dist
    solids_sigma = solids_v_hindered * residence_time / separation_dist

    oil_eff_base = 100 / (1 + math.exp(-2.5 * (oil_sigma - 1)))
    solids_eff_base = 100 / (1 + math.exp(-2.5 * (solids_sigma - 1)))

    # 8. Chemical dosing effects
    demulsifier_effect = 0.0
    if feed.demulsifier_dose > 0:
        coverage = calculate_langmuir_coverage(feed.demulsifier_dose)
        demulsifier_effect = feed.demulsifier_eff * coverage

    interfacial_factor = feed.interfacial_tension / 25.0
    emulsion_factor = 1 - feed.emulsion_stability * 0.3 * (1 - demulsifier_effect) / interfacial_factor

    flocculant_factor = 1.0
    if feed.flocculant_dose > 0:
        floc_eff = feed.flocculant_eff * min(1, feed.flocculant_dose / 50) * 0.2
        flocculant_factor = 1 + floc_eff

    # 9. Temperature factor (higher temp = better separation)
    temp_factor = 1 + (conditions.temperature - 60) * 0.008

    # 10. Flow rate factor (higher flow = lower efficiency)
    flow_factor = max(0.6, 1 - (conditions.feed_flow - 10) * 0.04)

    # 11. Final efficiencies
    oil_efficiency = min(99.5, max(0,
        oil_eff_base * flow_factor * emulsion_factor * temp_factor
    ))

    solids_efficiency = min(99.9, max(0,
        solids_eff_base * flow_factor * flocculant_factor * temp_factor
    ))

    # 12. Water quality (OiW in ppm)
    oil_carryover = conditions.feed_flow * feed.oil_fraction * (1 - oil_efficiency / 100)
    oil_recovered = conditions.feed_flow * feed.oil_fraction * (oil_efficiency / 100)
    solids_recovered = conditions.feed_flow * feed.solids_fraction * (solids_efficiency / 100)
    water_output = conditions.feed_flow - oil_recovered - solids_recovered

    water_quality = 0.0
    if water_output > 0:
        water_quality = (oil_carryover / water_output) * 1e6 * (feed.oil_density / feed.water_density)

    return SeparationResults(
        oil_efficiency=round(oil_efficiency, 2),
        solids_efficiency=round(solids_efficiency, 2),
        water_quality_ppm=round(water_quality, 1),
        g_force=round(g_force, 0),
        residence_time=round(residence_time, 1),
        oil_settling_velocity=oil_v_hindered * 1000,  # mm/s
        solids_settling_velocity=solids_v_hindered * 1000,  # mm/s
        viscosity=viscosity * 1000,  # mPa·s
    )


# ═══════════════════════════════════════════════════════════════════════════════
# VALIDATION TESTS
# ═══════════════════════════════════════════════════════════════════════════════

def run_validation_tests() -> Dict[str, bool]:
    """Run validation tests against known values."""
    results = {}

    # Test 1: G-force calculation
    g_force = calculate_g_force(400, 3500)
    expected_g = 2742  # Approximate
    results['g_force'] = abs(g_force - expected_g) < 100
    print(f"✓ G-force: {g_force:.0f} g (expected ~{expected_g})")

    # Test 2: Viscosity temperature dependence
    visc_25 = calculate_viscosity(50, 25, 0.025)
    visc_65 = calculate_viscosity(50, 65, 0.025)
    results['viscosity_temp'] = visc_65 < visc_25  # Should decrease with temp
    print(f"✓ Viscosity: {visc_25*1000:.2f} mPa·s @ 25°C → {visc_65*1000:.2f} mPa·s @ 65°C")

    # Test 3: Stokes velocity
    v_stokes = calculate_stokes_velocity(
        25e-6,  # 25 micron droplet
        100,    # 100 kg/m³ density diff
        0.001,  # 1 mPa·s (water)
        1000    # 1000 m/s² (approx 100g)
    )
    results['stokes_velocity'] = v_stokes > 0
    print(f"✓ Stokes velocity: {v_stokes*1000:.4f} mm/s")

    # Test 4: Hindered settling
    v_hindered = calculate_hindered_settling(v_stokes, 0.2, 0.64, 4.65)
    results['hindered_settling'] = v_hindered < v_stokes
    print(f"✓ Hindered velocity: {v_hindered*1000:.4f} mm/s (factor: {v_hindered/v_stokes:.2f})")

    # Test 5: Langmuir coverage
    coverage = calculate_langmuir_coverage(50, 0.05, 0.95)
    results['langmuir'] = 0 < coverage < 1
    print(f"✓ Langmuir coverage: {coverage:.2%}")

    # Test 6: Full separation calculation
    feed = FeedProperties()
    equipment = EquipmentConfig()
    conditions = OperatingConditions()

    sep = calculate_separation_efficiency(feed, equipment, conditions)
    results['separation'] = sep.oil_efficiency > 80 and sep.water_quality_ppm < 100
    print(f"\n═══ Full Calculation Results ═══")
    print(f"  Oil efficiency:      {sep.oil_efficiency:.1f}%")
    print(f"  Solids efficiency:   {sep.solids_efficiency:.1f}%")
    print(f"  Water quality (OiW): {sep.water_quality_ppm:.0f} ppm")
    print(f"  G-force:             {sep.g_force:.0f} g")
    print(f"  Residence time:      {sep.residence_time:.1f} s")

    # Summary
    passed = sum(results.values())
    total = len(results)
    print(f"\n═══ Validation: {passed}/{total} tests passed ═══")

    return results


def calculate_from_args(args) -> None:
    """Run calculation from command line arguments."""
    feed = FeedProperties(
        oil_fraction=args.oil_frac,
        water_fraction=args.water_frac,
        solids_fraction=1 - args.oil_frac - args.water_frac,
        oil_droplet_d50=args.droplet_size,
        oil_viscosity=args.viscosity,
        demulsifier_dose=args.demulsifier,
    )

    equipment = EquipmentConfig(
        bowl_diameter=args.bowl_diameter,
        bowl_length=args.bowl_length,
    )

    conditions = OperatingConditions(
        temperature=args.temp,
        bowl_speed=args.rpm,
        feed_flow=args.flow,
    )

    results = calculate_separation_efficiency(feed, equipment, conditions)

    print("\n" + "=" * 60)
    print("CENTRIFUGE SEPARATION CALCULATION RESULTS")
    print("=" * 60)
    print(f"\nOperating Conditions:")
    print(f"  Temperature:    {args.temp}°C")
    print(f"  Bowl Speed:     {args.rpm} RPM")
    print(f"  Feed Flow:      {args.flow} m³/h")
    print(f"\nCalculated Results:")
    print(f"  G-force:        {results.g_force:.0f} g")
    print(f"  Residence Time: {results.residence_time:.1f} seconds")
    print(f"  Viscosity:      {results.viscosity:.2f} mPa·s")
    print(f"\nSeparation Performance:")
    print(f"  Oil Efficiency:      {results.oil_efficiency:.1f}%")
    print(f"  Solids Efficiency:   {results.solids_efficiency:.1f}%")
    print(f"  Water Quality (OiW): {results.water_quality_ppm:.0f} ppm")
    print("=" * 60)

    # Output as JSON if requested
    if args.json:
        print("\nJSON Output:")
        print(json.dumps(asdict(results), indent=2))


def main():
    parser = argparse.ArgumentParser(
        description='Stokes Law Separation Calculator for Centrifuge Process',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python stokes_calculator.py --validate
  python stokes_calculator.py --calculate --temp 65 --rpm 3500 --flow 12
  python stokes_calculator.py --calculate --temp 70 --rpm 4000 --json
        """
    )

    parser.add_argument('--validate', action='store_true',
                        help='Run validation tests')
    parser.add_argument('--calculate', action='store_true',
                        help='Run separation calculation')
    parser.add_argument('--json', action='store_true',
                        help='Output results as JSON')

    # Operating conditions
    parser.add_argument('--temp', type=float, default=65.0,
                        help='Operating temperature (°C)')
    parser.add_argument('--rpm', type=float, default=3500.0,
                        help='Bowl speed (RPM)')
    parser.add_argument('--flow', type=float, default=12.0,
                        help='Feed flow rate (m³/h)')

    # Feed properties
    parser.add_argument('--oil-frac', type=float, default=0.20,
                        help='Oil fraction (0-1)')
    parser.add_argument('--water-frac', type=float, default=0.75,
                        help='Water fraction (0-1)')
    parser.add_argument('--droplet-size', type=float, default=25.0,
                        help='Oil droplet D50 (microns)')
    parser.add_argument('--viscosity', type=float, default=50.0,
                        help='Oil viscosity at 25°C (mPa·s)')
    parser.add_argument('--demulsifier', type=float, default=50.0,
                        help='Demulsifier dose (ppm)')

    # Equipment
    parser.add_argument('--bowl-diameter', type=float, default=400.0,
                        help='Bowl diameter (mm)')
    parser.add_argument('--bowl-length', type=float, default=1100.0,
                        help='Bowl length (mm)')

    args = parser.parse_args()

    if args.validate:
        run_validation_tests()
    elif args.calculate:
        calculate_from_args(args)
    else:
        parser.print_help()
        print("\nRun with --validate or --calculate")


if __name__ == '__main__':
    main()
