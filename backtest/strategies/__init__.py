from .base import Strategy
from .cross_platform_arb import CrossPlatformArbitrage
from .lead_lag_vol import LeadLagVolatility
from .insurance_overlay import InsuranceOverlay
from .dynamic_hedge import DynamicHedge
from .mean_reversion import MeanReversion
from .market_making import MarketMaking

ALL_STRATEGIES = {
    "cross_platform_arb": CrossPlatformArbitrage,
    "lead_lag_vol": LeadLagVolatility,
    "insurance_overlay": InsuranceOverlay,
    "dynamic_hedge": DynamicHedge,
    "mean_reversion": MeanReversion,
    "market_making": MarketMaking,
}
