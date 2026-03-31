# Goal-Based Investment Tracker: Research & Implementation Rules

Research compiled: 2026-03-24

---

## 1. GOAL CLASSIFICATION & TIME HORIZONS

### Goal Categories
| Category | Horizon | Risk Profile | Primary Instruments |
|----------|---------|-------------|-------------------|
| Short-term | 0-3 years | Conservative | Liquid funds, FDs, Savings |
| Medium-term | 3-7 years | Moderate | Hybrid funds, Short-duration debt, Corporate bonds |
| Long-term | 7+ years | Aggressive | Equity MFs, Index funds, ELSS, NPS |

### Common Indian Goals (use as presets in UI)
- Emergency fund (immediate)
- Vacation / gadget (1-2 years)
- Car purchase (3-5 years)
- Home down payment (5-7 years)
- Child education (10-18 years)
- Child marriage (15-25 years)
- Retirement (20-35 years)
- Financial independence / FIRE

---

## 2. ASSET ALLOCATION RULES

### Age-Based Default Allocation (implementable lookup table)
| Age Range | Equity % | Debt % | Gold % |
|-----------|---------|--------|--------|
| 20-29 | 80 | 15 | 5 |
| 30-39 | 70 | 25 | 5 |
| 40-49 | 60 | 35 | 5 |
| 50-59 | 40 | 50 | 10 |
| 60+ | 20 | 65 | 15 |

### Formula: `equityPercent = max(20, min(80, 100 - age))`
- Variant (more aggressive): `equityPercent = max(20, min(90, 120 - age))`
- The 120-age rule has a 70% success rate vs 19% for 100-age (per Arthgyaan backtesting)

### Goal-Based Allocation (override age-based when goal horizon is known)
| Years to Goal | Equity % | Debt % | Gold/Liquid % |
|---------------|---------|--------|---------------|
| 10+ years | 80 | 15 | 5 |
| 7-10 years | 70 | 25 | 5 |
| 5-7 years | 50 | 40 | 10 |
| 3-5 years | 30 | 60 | 10 |
| 1-3 years | 10 | 70 | 20 |
| < 1 year | 0 | 50 | 50 |

---

## 3. EQUITY GLIDE PATH (Auto-Reduce Equity as Goal Approaches)

### Implementation: Linear Glide Path Formula
```
equityPercent = maxEquity - ((maxEquity - minEquity) / totalYears) * yearsElapsed
```

### Recommended Glide Path Schedule (for each goal)
| Years Remaining | Equity % | Debt % | Action |
|----------------|---------|--------|--------|
| 10+ | 80-90 | 10-20 | Full growth mode |
| 7-10 | 70 | 30 | Begin gradual shift |
| 5-7 | 50-60 | 40-50 | Accelerate shift |
| 3-5 | 30-40 | 60-70 | Protection mode |
| 1-3 | 10-20 | 80-90 | Capital preservation |
| < 1 | 0 | 100 | Fully safe |

### SEBI Life Cycle Fund Reference
- Early years (20-25 yrs to target): 65-95% equity
- Near maturity: below 65% equity (tax treatment changes at 65% threshold)
- Exit loads: up to 3% in year 1, gradually reducing

### Trigger: Rebalance Check
- Run glide path check every 6 months OR when goal is < 5 years away
- When years_remaining crosses a threshold boundary, prompt user to rebalance

---

## 4. BUCKET STRATEGY (Retirement Drawdown)

### Three Buckets
| Bucket | Horizon | Allocation % | Target Return | Instruments |
|--------|---------|-------------|--------------|-------------|
| 1 - Cash | 0-3 years | 15% | ~5% | Liquid funds, ultra-short debt, bank FDs |
| 2 - Income | 4-10 years | 35% | ~7% | Short-duration debt, corporate bond funds, balanced advantage |
| 3 - Growth | 11-30 years | 50% | ~9% | Equity MFs, index funds, hybrid equity |

### Concrete Example (implementable)
```
Corpus: ₹4.67 Cr
Monthly expense at retirement: ₹1.50 Lakh

Bucket 1: ₹54 Lakh (36 months x ₹1.5L) -> Liquid/FD
Bucket 2: ₹1.26 Cr (84 months x ₹1.5L, discounted at 7%) -> Debt funds
Bucket 3: Remaining ₹2.87 Cr -> Equity/Index funds

Combined portfolio yield: ~8.13%
Sustainability: ~27-28 years
```

### Refill Logic
- When Bucket 1 depletes to < 12 months of expenses, refill from Bucket 2
- When Bucket 2 depletes to < 3 years, refill from Bucket 3
- Only refill from Bucket 3 when equity markets are NOT in a drawdown (>10% fall)

---

## 5. REBALANCING RULES

### Hybrid Approach (recommended for implementation)
- **Calendar**: Review every 6 months (suggest January and July)
- **Threshold**: Act only if any major sleeve deviates by >=5 percentage points from target
- **5/25 Rule for smaller sleeves**: Rebalance when a sleeve moves by either:
  - 5 percentage points absolute, OR
  - 25% relative to its target weight
  - Example: 10% gold target -> triggers at <7.5% or >12.5%

### Rebalancing Priority Order
1. First, redirect new SIP contributions to the underweight asset class
2. If still out of band after contributions, sell from overweight class
3. Before selling, prefer lots with the smallest gains (tax optimization)
4. Factor in exit loads (most equity MFs: 1% if redeemed within 1 year)

### Tax-Aware Rebalancing
- Avoid selling equity held < 12 months (STCG at 20%)
- Prefer selling equity held > 12 months (LTCG at 12.5%, first ₹1.25L exempt)
- Debt funds purchased after April 2023 have NO LTCG benefit (always taxed at slab rate)
- Use new contributions to rebalance whenever possible to minimize tax events

---

## 6. SIP STEP-UP CALCULATOR

### Formula
```javascript
// Step-Up SIP Future Value
function stepUpSIPFutureValue(monthlyAmount, annualReturn, years, stepUpPercent) {
  const monthlyRate = annualReturn / 12 / 100;
  let totalValue = 0;
  let currentMonthly = monthlyAmount;

  for (let year = 0; year < years; year++) {
    // FV of 12 months of SIP at currentMonthly, compounded for remaining years
    for (let month = 0; month < 12; month++) {
      const monthsRemaining = (years - year) * 12 - month;
      totalValue += currentMonthly * Math.pow(1 + monthlyRate, monthsRemaining);
    }
    currentMonthly *= (1 + stepUpPercent / 100); // step up annually
  }
  return totalValue;
}
```

### Recommended Step-Up Percentages
- Conservative: 5% (below typical salary hike)
- Moderate: 10% (matches average salary hike in India)
- Aggressive: 15% (for high-growth careers, IT sector)
- Best practice: Match your expected annual salary increment

### Concrete Examples
| Scenario | Monthly SIP | Step-Up | Years | Return | Total Invested | Future Value |
|----------|------------|---------|-------|--------|---------------|-------------|
| Housing (8yr) | ₹10,000 | 10% | 8 | 14% | ₹13.72L | ₹23.66L |
| Retirement (20yr) | ₹20,000 | 15% | 20 | 12% | ₹2.46Cr | ₹6.05Cr |
| Education (5yr) | ₹2,000 | 5% | 5 | 15% | ₹1.33L | ₹1.95L |

---

## 7. RETIREMENT CORPUS CALCULATOR

### Core Formulas

#### Step 1: Future Monthly Expense (inflation-adjusted)
```
futureExpense = currentExpense * (1 + inflationRate) ^ yearsToRetirement
```
Example: ₹50,000/month today, retire in 20 years at 6% inflation
= ₹50,000 * (1.06)^20 = ₹1,60,357/month

#### Step 2: Required Corpus (Annuity Method)
```
realReturn = (1 + postRetirementReturn) / (1 + inflationRate) - 1
corpus = annualExpense * [(1 - (1 + realReturn)^(-retirementDuration)) / realReturn]
```

#### Step 3: Quick Estimate (Multiplier Method)
```
corpus = annualExpenseAtRetirement * 25  (4% rule -> multiply by 25)
corpus = annualExpenseAtRetirement * 33  (3% rule -> more conservative for India)
```

### India-Specific Assumptions
| Parameter | Conservative | Moderate | Aggressive |
|-----------|-------------|----------|-----------|
| General inflation | 7% | 6% | 5% |
| Medical inflation | 15% | 12% | 10% |
| Pre-retirement return (equity-heavy) | 10% | 12% | 14% |
| Post-retirement return (debt-heavy) | 6% | 7% | 8% |
| Real return (post-retirement) | -1% to 0% | 1% | 2% |
| Safe withdrawal rate | 3% | 3.5% | 4% |

### Complete Example
```
Current age: 30
Retirement age: 60
Life expectancy: 85
Current monthly expense: ₹50,000
Inflation: 6%
Post-retirement return: 7%

Step 1: Future monthly expense = ₹50,000 * (1.06)^30 = ₹2,87,175
Step 2: Annual expense at retirement = ₹34,46,099
Step 3: Corpus needed (25x) = ₹8.62 Cr
Step 3 alt: Corpus needed (33x, conservative) = ₹11.37 Cr

Real return = (1.07/1.06) - 1 = 0.943%
Annuity factor for 25 years at 0.943% = 22.2
Corpus (annuity method) = ₹34,46,099 * 22.2 = ₹7.65 Cr

Required monthly SIP at 12% return for 30 years = ~₹21,800
With 10% annual step-up starting at ₹10,000: achievable
```

---

## 8. EMERGENCY FUND SIZING

### Sizing Rules (implementable logic)
```javascript
function emergencyFundMonths(profile) {
  const rules = {
    'single_stable': 3,
    'single_contract': 6,
    'married_no_kids': 4,
    'married_with_kids': 6,
    'married_with_dependents': 9,  // dependent parents
    'entrepreneur': 12,
    'freelancer': 9,
    'single_income_family': 9,
  };
  return rules[profile] || 6; // default 6 months
}
```

### Amount = Essential Monthly Expenses x Months
- Include: rent/EMI, groceries, utilities, insurance premiums, school fees, loan EMIs
- Exclude: discretionary spending, investments, entertainment

### Where to Park (allocation formula)
| Instrument | Allocation | Expected Return | Liquidity |
|-----------|-----------|----------------|-----------|
| Savings account | 30% | 3-3.5% | Instant |
| Fixed deposits (laddered) | 30% | 6-7.5% | 1-7 days |
| Liquid mutual funds | 40% | 6-7% | T+1 day (instant up to ₹50K) |

### FD Laddering Strategy
Instead of 1 large FD, split into 4 equal FDs:
- ₹4.5L emergency fund -> 4 FDs of ₹1.125L each
- Break only what you need, rest continues earning interest

---

## 9. INDIA-SPECIFIC INSTRUMENT RETURNS (for default assumptions)

### Fixed-Return Instruments (FY 2025-26)
| Instrument | Return | Tax Treatment | Lock-in |
|-----------|--------|--------------|---------|
| PPF | 7.1% | EEE (fully exempt) | 15 years (partial withdrawal from year 7) |
| EPF | 8.25% | EEE (exempt up to ₹2.5L contribution/yr) | Till retirement |
| NPS Tier 1 | 8-10% (historical) | EET (60% exempt at maturity) | Till 60 (25% partial at 3 yrs) |
| Sukanya Samriddhi | 8.2% | EEE | 21 years or marriage after 18 |
| Senior Citizen Savings | 8.2% | Taxable | 5 years |
| Bank FD | 6-7.5% | Taxable at slab | Flexible |
| Post Office TD (5yr) | 7.5% | Sec 80C deduction | 5 years |
| ELSS (equity) | ~12-15% (historical) | LTCG 12.5% above ₹1.25L | 3 years |

### Tax Rates on Capital Gains (FY 2025-26)
| Fund Type | STCG Rate | STCG Period | LTCG Rate | LTCG Period | Exemption |
|-----------|-----------|------------|-----------|------------|-----------|
| Equity MF (>=65% equity) | 20% | <=12 months | 12.5% | >12 months | ₹1.25L/year |
| Debt MF (post Apr 2023) | Slab rate | Always | N/A | N/A | None |
| Hybrid (equity <65%) | Slab rate | <=24 months | 12.5% | >24 months | None |
| Gold ETF | Slab rate | <=12 months | 12.5% | >24 months | None |

### Key Tax Rules for Implementation
- Each SIP installment is treated as a separate purchase (FIFO on redemption)
- STCL can offset both STCG and LTCG
- LTCL can offset only LTCG
- Losses carry forward up to 8 assessment years
- Indexation benefit REMOVED for all funds under new regime

---

## 10. UI/UX PATTERNS FROM INDIAN FINANCE APPS

### Kuvera
- Goal-based investing is the core navigation paradigm
- Risk slider (Low to High) at top of investment selection
- Toggle between Growth and Dividend categories
- Tax optimization features (tax-loss harvesting suggestions)
- Clean, minimal UI with goal progress tracking

### INDmoney
- Single dashboard for all goals with real-time progress
- Family wealth tracking (aggregate across family members)
- Goal customization with graphical progress representations
- Converts complex financial data into simplified charts
- Robo-advisory integration for goal-based planning

### Groww
- 5-step approach: Set Goal -> Calculate -> Choose Funds -> Start SIP -> Track
- Beginner-friendly, simple UI
- Learning content integrated into the investment flow
- Clear fee transparency

### ET Money
- Goal-based mutual fund recommendations
- SIP calculator with step-up option built in
- Portfolio health score
- Tax-saving investment suggestions

### Common UI Patterns to Implement
1. **Goal cards**: Each goal as a card with progress bar, target amount, current value, % achieved
2. **Color coding**: Green (on track), Yellow (slightly behind), Red (significantly behind)
3. **Time-based progress**: "X years Y months remaining"
4. **SIP recommendation**: "Increase SIP by ₹X to stay on track"
5. **Milestone markers**: 25%, 50%, 75%, 100% of goal with celebrations
6. **What-if calculator**: Slider to adjust SIP amount and see projected outcome
7. **Allocation pie chart**: Visual split of equity/debt/gold for each goal
8. **Rebalancing alerts**: Banner notification when allocation drifts beyond threshold

---

## 11. IMPLEMENTABLE FORMULAS SUMMARY

### Future Value of Lump Sum
```
FV = PV * (1 + r)^n
```

### Future Value of SIP (regular monthly)
```
FV = P * [((1 + r)^n - 1) / r] * (1 + r)
where r = annual_return / 12, n = months
```

### Future Value of Step-Up SIP
```
No closed-form. Use iterative calculation:
For each year y (0 to totalYears-1):
  monthlyAmount = initialSIP * (1 + stepUp%)^y
  For each month m (0 to 11):
    monthsRemaining = totalMonths - (y*12 + m)
    FV += monthlyAmount * (1 + monthlyRate)^monthsRemaining
```

### Required Monthly SIP to Reach Goal
```
SIP = FV * r / [((1 + r)^n - 1) * (1 + r)]
where r = annual_return / 12, n = months
```

### Inflation-Adjusted Goal Amount
```
goalAmount = todayAmount * (1 + inflation)^years
```

### Retirement Corpus (Present Value of Annuity)
```
realRate = (1 + nominalReturn) / (1 + inflation) - 1
corpus = annualExpense * [(1 - (1 + realRate)^(-years)) / realRate]
```

### Monthly SWP Amount (from corpus)
```
monthlyWithdrawal = corpus * monthlyRealRate / [1 - (1 + monthlyRealRate)^(-totalMonths)]
```

### Goal On-Track Check
```
expectedValue = SIP_FV_at_current_rate_for_elapsed_months
actualValue = current_portfolio_value
onTrackRatio = actualValue / expectedValue
Status: >0.95 = Green, 0.80-0.95 = Yellow, <0.80 = Red
```
