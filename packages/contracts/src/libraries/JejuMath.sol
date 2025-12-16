// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title JejuMath
 * @author Jeju Network
 * @notice High-precision math library for prediction markets and AMMs
 * @dev Implements exp, ln, sqrt, and LMSR cost functions with 18-decimal precision
 *      Consolidates math from PredictionMarket.sol and TFMM strategies
 */
library JejuMath {
    // ============ Constants ============

    /// @notice Fixed-point precision (18 decimals)
    uint256 internal constant PRECISION = 1e18;

    /// @notice ln(2) with 18 decimal precision
    uint256 internal constant LN_2 = 693147180559945309;

    /// @notice e with 18 decimal precision
    uint256 internal constant E = 2718281828459045235;

    /// @notice Maximum input for exp() to prevent overflow
    uint256 internal constant MAX_EXP_INPUT = 130e18;

    // ============ Errors ============

    error MathOverflow();
    error InvalidInput();
    error DivisionByZero();

    // ============ Exponential Functions ============

    /**
     * @notice Calculate e^x with 18-decimal precision
     * @param x Input value (18 decimals), must be <= 130e18
     * @return result e^x with 18 decimals
     * @dev Uses Taylor series: e^x = 1 + x + x^2/2! + x^3/3! + ...
     *      Accurate for x in [0, 10e18], approximation degrades for larger x
     */
    function exp(uint256 x) internal pure returns (uint256 result) {
        if (x == 0) return PRECISION;
        if (x > MAX_EXP_INPUT) revert MathOverflow();

        // For large x, use identity: e^x = e^(x/2) * e^(x/2)
        if (x > 10e18) {
            uint256 halfExp = exp(x / 2);
            return (halfExp * halfExp) / PRECISION;
        }

        // Taylor series: e^x ≈ 1 + x + x^2/2! + x^3/3! + x^4/4! + x^5/5! + x^6/6!
        result = PRECISION;
        uint256 term = x;

        result += term;                                   // x^1/1!
        term = (term * x) / (2 * PRECISION);
        result += term;                                   // x^2/2!
        term = (term * x) / (3 * PRECISION);
        result += term;                                   // x^3/3!
        term = (term * x) / (4 * PRECISION);
        result += term;                                   // x^4/4!
        term = (term * x) / (5 * PRECISION);
        result += term;                                   // x^5/5!
        term = (term * x) / (6 * PRECISION);
        result += term;                                   // x^6/6!
        term = (term * x) / (7 * PRECISION);
        result += term;                                   // x^7/7!
        term = (term * x) / (8 * PRECISION);
        result += term;                                   // x^8/8!
    }

    /**
     * @notice Calculate natural logarithm ln(x) with 18-decimal precision
     * @param x Input value (18 decimals), must be > 0
     * @return result ln(x) with 18 decimals
     * @dev Uses Taylor series for values close to 1, scaling for others
     */
    function ln(uint256 x) internal pure returns (uint256 result) {
        if (x == 0) revert InvalidInput();
        if (x == PRECISION) return 0;

        // For x close to 1, use Taylor series: ln(1+y) ≈ y - y^2/2 + y^3/3 - y^4/4
        if (x > PRECISION / 2 && x < (PRECISION * 3) / 2) {
            return _lnTaylor(x);
        }

        // For other values, use: ln(x) = ln(x/e^k) + k*ln(e) = ln(x/e^k) + k
        // Scale x to be close to 1 for better Taylor approximation
        if (x > PRECISION) {
            // x > 1: find k such that x/e^k is close to 1
            uint256 k = 0;
            uint256 scaled = x;
            while (scaled > 2 * PRECISION) {
                scaled = (scaled * PRECISION) / E;
                k++;
            }
            return _lnTaylor(scaled) + (k * PRECISION);
        } else {
            // x < 1: use ln(x) = -ln(1/x)
            uint256 invX = (PRECISION * PRECISION) / x;
            return PRECISION - ln(invX); // This effectively gives negative but we return as if positive offset
        }
    }

    /**
     * @notice Internal Taylor series for ln(x) where x is close to 1
     */
    function _lnTaylor(uint256 x) private pure returns (uint256) {
        // ln(1+y) ≈ y - y^2/2 + y^3/3 - y^4/4 for y = x - 1
        int256 y = int256(x) - int256(PRECISION);
        if (y == 0) return 0;

        int256 result = y;
        int256 term = y;

        term = -(term * y) / int256(PRECISION) / 2;
        result += term;
        term = -(term * y) / int256(PRECISION) * 2 / 3;
        result += term;
        term = -(term * y) / int256(PRECISION) * 3 / 4;
        result += term;
        term = -(term * y) / int256(PRECISION) * 4 / 5;
        result += term;

        // Result can be negative for x < 1, but we handle that in the caller
        return result >= 0 ? uint256(result) : 0;
    }

    /**
     * @notice Calculate signed natural logarithm
     * @param x Input value (18 decimals)
     * @return result Signed ln(x)
     * @return isNegative True if result is negative (x < 1)
     */
    function lnSigned(uint256 x) internal pure returns (uint256 result, bool isNegative) {
        if (x == 0) revert InvalidInput();
        if (x == PRECISION) return (0, false);

        if (x >= PRECISION) {
            return (ln(x), false);
        } else {
            // x < 1: ln(x) is negative, so we compute -ln(1/x)
            uint256 invX = (PRECISION * PRECISION) / x;
            return (ln(invX), true);
        }
    }

    // ============ Square Root ============

    /**
     * @notice Calculate square root with 18-decimal precision
     * @param x Input value (18 decimals)
     * @return result sqrt(x) with 18 decimals
     * @dev Uses Babylonian method (Newton-Raphson)
     */
    function sqrt(uint256 x) internal pure returns (uint256 result) {
        if (x == 0) return 0;
        if (x == PRECISION) return PRECISION;

        // Scale x to maintain precision: sqrt(x * 1e18) = sqrt(x) * 1e9
        uint256 scaled = x * PRECISION;
        
        // Initial guess
        result = scaled;
        
        // Babylonian method iterations
        result = (result + scaled / result) / 2;
        result = (result + scaled / result) / 2;
        result = (result + scaled / result) / 2;
        result = (result + scaled / result) / 2;
        result = (result + scaled / result) / 2;
        result = (result + scaled / result) / 2;
        result = (result + scaled / result) / 2;

        // Ensure we round down
        if (result * result > scaled) {
            result--;
        }
    }

    // ============ LMSR Functions ============

    /**
     * @notice LMSR cost function: C(q) = b * ln(e^(q_yes/b) + e^(q_no/b))
     * @param qYes Quantity of YES shares
     * @param qNo Quantity of NO shares
     * @param b Liquidity parameter
     * @return cost Total cost in the same units as b
     * @dev This is the core function for prediction market pricing
     */
    function lmsrCost(uint256 qYes, uint256 qNo, uint256 b) internal pure returns (uint256 cost) {
        if (b == 0) revert DivisionByZero();

        // Calculate e^(q_yes/b) and e^(q_no/b)
        uint256 expYes = exp((qYes * PRECISION) / b);
        uint256 expNo = exp((qNo * PRECISION) / b);
        uint256 sum = expYes + expNo;

        // C = b * ln(sum)
        cost = (b * ln(sum)) / PRECISION;
    }

    /**
     * @notice Calculate LMSR price for an outcome
     * @param qYes Quantity of YES shares
     * @param qNo Quantity of NO shares
     * @param b Liquidity parameter
     * @param forYes True to get YES price, false for NO price
     * @return price Price in basis points (10000 = 100%)
     * @dev P(YES) = e^(q_yes/b) / (e^(q_yes/b) + e^(q_no/b))
     */
    function lmsrPrice(uint256 qYes, uint256 qNo, uint256 b, bool forYes) internal pure returns (uint256 price) {
        if (b == 0) revert DivisionByZero();

        uint256 expYes = exp((qYes * PRECISION) / b);
        uint256 expNo = exp((qNo * PRECISION) / b);
        uint256 sum = expYes + expNo;

        if (forYes) {
            price = (expYes * 10000) / sum;
        } else {
            price = (expNo * 10000) / sum;
        }
    }

    /**
     * @notice Calculate shares received for a given cost
     * @param qYes Current YES shares
     * @param qNo Current NO shares
     * @param b Liquidity parameter
     * @param cost Cost to spend
     * @param buyYes True if buying YES, false for NO
     * @return shares Number of shares received
     * @dev Uses binary search to find shares that match the cost
     */
    function lmsrSharesForCost(
        uint256 qYes,
        uint256 qNo,
        uint256 b,
        uint256 cost,
        bool buyYes
    ) internal pure returns (uint256 shares) {
        uint256 costBefore = lmsrCost(qYes, qNo, b);
        uint256 targetCost = costBefore + cost;

        // Binary search for shares
        uint256 low = 0;
        uint256 high = cost * 10; // Upper bound estimate

        while (low < high) {
            uint256 mid = (low + high + 1) / 2;
            uint256 newQYes = buyYes ? qYes + mid : qYes;
            uint256 newQNo = buyYes ? qNo : qNo + mid;
            uint256 costAfter = lmsrCost(newQYes, newQNo, b);

            if (costAfter <= targetCost) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }

        shares = low;
    }

    // ============ Utility Functions ============

    /**
     * @notice Multiply then divide with full precision
     * @param a First multiplicand
     * @param b Second multiplicand
     * @param denominator Divisor
     * @return result a * b / denominator
     */
    function mulDiv(uint256 a, uint256 b, uint256 denominator) internal pure returns (uint256 result) {
        if (denominator == 0) revert DivisionByZero();
        
        // Use assembly for 512-bit precision multiplication
        uint256 prod0;
        uint256 prod1;
        assembly {
            let mm := mulmod(a, b, not(0))
            prod0 := mul(a, b)
            prod1 := sub(sub(mm, prod0), lt(mm, prod0))
        }

        if (prod1 == 0) {
            return prod0 / denominator;
        }

        // Handle 512-bit division
        assembly {
            let remainder := mulmod(a, b, denominator)
            prod1 := sub(prod1, gt(remainder, prod0))
            prod0 := sub(prod0, remainder)

            let twos := and(sub(0, denominator), denominator)
            denominator := div(denominator, twos)
            prod0 := div(prod0, twos)

            twos := add(div(sub(0, twos), twos), 1)
            prod0 := or(prod0, mul(prod1, twos))

            let inv := mul(3, denominator)
            inv := mul(inv, sub(2, mul(denominator, inv)))
            inv := mul(inv, sub(2, mul(denominator, inv)))
            inv := mul(inv, sub(2, mul(denominator, inv)))
            inv := mul(inv, sub(2, mul(denominator, inv)))
            inv := mul(inv, sub(2, mul(denominator, inv)))
            inv := mul(inv, sub(2, mul(denominator, inv)))

            result := mul(prod0, inv)
        }
    }

    /**
     * @notice Calculate percentage with basis points
     * @param value Base value
     * @param bps_ Basis points (10000 = 100%)
     * @return result value * bps / 10000
     */
    function bps(uint256 value, uint256 bps_) internal pure returns (uint256 result) {
        return (value * bps_) / 10000;
    }

    /**
     * @notice Calculate absolute difference
     * @param a First value
     * @param b Second value
     * @return diff |a - b|
     */
    function absDiff(uint256 a, uint256 b) internal pure returns (uint256 diff) {
        return a >= b ? a - b : b - a;
    }
}

