/**
 * MARKET BRIDGE QUANTUM MACRO V27 UNIFIED - PARTE 1/5
 * Configuración, Utilidades y Clases Base
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN INMUTABLE V27 (Object.freeze)
// ═══════════════════════════════════════════════════════════════════════════════
const V27_CONFIG = Object.freeze({
    VERSION: '27.0.0-ULTIMATE',
    BUILD_DATE: '2026-02-20',
    SECURITY: {
        FLASH_CRASH_THRESHOLD: 0.005, // 0.5% de movimiento en milisegundos
        TIME_WINDOW_MS: 300,          // Ventana de tiempo de detección (muy rápida)
        LOCKOUT_DURATION: 10000       // Si detecta trampa, bloquea 10 segundos
    },

    ML: {
        LSTM: {
            UNITS: 128,
            LAYERS: 3,
            DROPOUT: 0.3,
            LEARNING_RATE: 0.0005,
            WINDOW_SIZE: 30,
            MAX_EPOCHS: 150,
            PATIENCE: 10,
            VALIDATION_SPLIT: 0.2
        },
        CNN: {
            FILTERS: [64, 32, 16],
            KERNEL_SIZE: 3,
            POOL_SIZE: 2
        },
        ENSEMBLE: {
            MODELS: ['lstm', 'cnn', 'technical'],
            WEIGHT_METHOD: 'bayesian',
            TEMPERATURE_BETA: 1.5
        },
        REGIMES: ['TREND', 'RANGE', 'HIGH_VOL', 'CRISIS'],
        BUFFER_SIZE: 10000,
        RETRAIN_THRESHOLD: 500
    },
    
    TECHNICAL: {
        RSI: { PERIOD: 14, OVERBOUGHT: 70, OVERSOLD: 30, DYNAMIC: true },
        MACD: { FAST: 12, SLOW: 26, SIGNAL: 9 },
        BOLLINGER: { PERIOD: 20, STD_DEV: 2 },
        ADX: { PERIOD: 14 },
        ATR: { PERIOD: 14 },
        VWAP: { ENABLED: true }
    },
    
    RISK: {
        MAX_DRAWDOWN: 0.15,
        CRISIS_VOL_THRESHOLD: 40,
        MAX_LATENCY_MS: 500,
        KELLY_FRACTION: 0.5,
        MIN_EDGE: 0.02,
        EXPOSURE_MAX: 1.0,
        EXPOSURE_MIN: 0.05,
        CIRCUIT_BREAKER: {
            CONSECUTIVE_LOSSES: 5,
            DAILY_LOSS_LIMIT: 0.10,
            VOLATILITY_SPIKE: 3.0
        }
    },
    
    TRADING: {
        MIN_BET: 10,
        MAX_MARTINGALE: 2,
        MARTINGALE_MULTIPLIER: 2.2,
        PAYOUT_DEFAULT: 0.85,
        TRAP_THRESHOLD_BASE: 0.65,
        TRAP_THRESHOLD_MIN: 0.45,
        TRAP_THRESHOLD_MAX: 0.85
    },
    
    HEDGE: {
        ENABLED: false,
        ASSETS: ["EURUSD", "BTCUSD", "XAUUSD", "GBPUSD", "USDJPY"],
        RISK_BUDGET: 0.02,
        REBALANCE_FREQ: 24,
        PPO: {
            GAMMA: 0.99,
            LAMBDA: 0.95,
            CLIP_EPSILON: 0.2,
            LEARNING_RATE: 0.0003
        }
    },
    
    INFRA: {
        WORKER_ENABLED: true,
        PROMETHEUS_PORT: 8080,
        LOG_LEVEL: 'INFO',
        LEDGER_HASH_ALGO: 'SHA-256'
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CLASES UTILITARIAS BASE
// ═══════════════════════════════════════════════════════════════════════════════

class ImmutableLedger {
    constructor() {
        this.entries = [];
        this.lastHash = '0'.repeat(64);
    }
    
    append(entry) {
        const timestamp = Date.now();
        const data = JSON.stringify(entry);
        const hash = this._hash(`${this.lastHash}${timestamp}${data}`);
        
        const record = {
            index: this.entries.length,
            timestamp,
            hash,
            previousHash: this.lastHash,
            data: entry
        };
        
        this.entries.push(record);
        this.lastHash = hash;
        return record;
    }
    
    _hash(data) {
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(64, '0');
    }
    
    verify() {
        for (let i = 1; i < this.entries.length; i++) {
            if (this.entries[i].previousHash !== this.entries[i-1].hash) {
                return false;
            }
        }
        return true;
    }
    
    getHistory() {
        return [...this.entries];
    }
}

class MetricsExporter {
    constructor() {
        this.metrics = new Map();
        this.counters = new Map();
        this.histograms = new Map();
    }
    
    counter(name, labels = {}) {
        const key = this._key(name, labels);
        this.counters.set(key, (this.counters.get(key) || 0) + 1);
    }
    
    gauge(name, value, labels = {}) {
        const key = this._key(name, labels);
        this.metrics.set(key, value);
    }
    
    histogram(name, value, labels = {}) {
        const key = this._key(name, labels);
        if (!this.histograms.has(key)) {
            this.histograms.set(key, []);
        }
        this.histograms.get(key).push(value);
    }
    
    _key(name, labels) {
        const labelStr = Object.entries(labels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',');
        return labelStr ? `${name}{${labelStr}}` : name;
    }
}

const MathUtils = {
    sma: (data, period) => {
        if (data.length < period) return null;
        const sum = data.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    },
    
    ema: (data, period) => {
        if (data.length < period) return null;
        const k = 2 / (period + 1);
        let ema = data[0];
        for (let i = 1; i < data.length; i++) {
            ema = data[i] * k + ema * (1 - k);
        }
        return ema;
    },
    
    stdDev: (data, period) => {
        if (data.length < period) return 0;
        const mean = data.slice(-period).reduce((a, b) => a + b, 0) / period;
        const variance = data.slice(-period).reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
        return Math.sqrt(variance);
    },
    
    percentile: (data, p) => {
        const sorted = [...data].sort((a, b) => a - b);
        const index = Math.floor(sorted.length * p);
        return sorted[index];
    },
    
    zScore: (value, mean, std) => {
        return std === 0 ? 0 : (value - mean) / std;
    },
    
    correlation: (x, y) => {
        const n = Math.min(x.length, y.length);
        const sumX = x.slice(0, n).reduce((a, b) => a + b, 0);
        const sumY = y.slice(0, n).reduce((a, b) => a + b, 0);
        const sumXY = x.slice(0, n).reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumX2 = x.slice(0, n).reduce((sum, xi) => sum + xi * xi, 0);
        const sumY2 = y.slice(0, n).reduce((sum, yi) => sum + yi * yi, 0);
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        
        return denominator === 0 ? 0 : numerator / denominator;
    },
    
    ksTest: (sample1, sample2) => {
        const all = [...sample1, ...sample2].sort((a, b) => a - b);
        let maxDiff = 0;
        
        for (const point of all) {
            const cdf1 = sample1.filter(x => x <= point).length / sample1.length;
            const cdf2 = sample2.filter(x => x <= point).length / sample2.length;
            maxDiff = Math.max(maxDiff, Math.abs(cdf1 - cdf2));
        }
        
        return maxDiff;
    },
    
    entropy: (probabilities) => {
        return probabilities.reduce((sum, p) => {
            return p > 0 ? sum - p * Math.log2(p) : sum;
        }, 0);
    }
};

window.V27_CONFIG = V27_CONFIG;
window.ImmutableLedger = ImmutableLedger;
window.MetricsExporter = MetricsExporter;
window.MathUtils = MathUtils;

console.log('✅ Parte 1/5 cargada: Configuración y Utilidades Base');



/**
 * MARKET BRIDGE QUANTUM MACRO V27 UNIFIED - PARTE 2/5
 * Indicadores Técnicos: Bollinger, MACD, RSI, ADX, ATR, VWAP
 */

class TechnicalIndicators {
    constructor(config = V27_CONFIG.TECHNICAL) {
        this.config = config;
        this.history = {
            prices: [],
            volumes: [],
            highs: [],
            lows: [],
            closes: []
        };
    }
    
    update(ohlcv) {
        this.history.prices.push(ohlcv.close);
        this.history.volumes.push(ohlcv.volume || 0);
        this.history.highs.push(ohlcv.high || ohlcv.close);
        this.history.lows.push(ohlcv.low || ohlcv.close);
        this.history.closes.push(ohlcv.close);
        
        const maxWindow = 200;
        if (this.history.prices.length > maxWindow) {
            this.history.prices.shift();
            this.history.volumes.shift();
            this.history.highs.shift();
            this.history.lows.shift();
            this.history.closes.shift();
        }
    }
    
    calculateBollinger(period = this.config.BOLLINGER.PERIOD, 
                       stdDev = this.config.BOLLINGER.STD_DEV) {
        const prices = this.history.closes;
        if (prices.length < period) {
            return { upper: null, middle: null, lower: null, bandwidth: null, squeeze: false, position: 0.5 };
        }
        
        const middle = MathUtils.sma(prices, period);
        const std = MathUtils.stdDev(prices, period);
        
        const upper = middle + (std * stdDev);
        const lower = middle - (std * stdDev);
        const bandwidth = ((upper - lower) / middle) * 100;
        const position = (prices[prices.length - 1] - lower) / (upper - lower);
        
        const bandwidthHistory = this._getBandwidthHistory(period);
        const squeeze = bandwidthHistory.length > 20 && 
                       bandwidth < MathUtils.percentile(bandwidthHistory, 0.25);
        
        const lastPrice = prices[prices.length - 1];
        const prevPrice = prices[prices.length - 2] || lastPrice;
        
        let signal = 'NEUTRAL';
        if (lastPrice > upper && prevPrice <= upper) signal = 'BREAKOUT_UP';
        else if (lastPrice < lower && prevPrice >= lower) signal = 'BREAKOUT_DOWN';
        else if (lastPrice > upper) signal = 'OVERBOUGHT';
        else if (lastPrice < lower) signal = 'OVERSOLD';
        
        return {
            upper: parseFloat(upper.toFixed(5)),
            middle: parseFloat(middle.toFixed(5)),
            lower: parseFloat(lower.toFixed(5)),
            bandwidth: parseFloat(bandwidth.toFixed(2)),
            squeeze,
            position: parseFloat(position.toFixed(4)),
            signal,
            stdDev: parseFloat(std.toFixed(5))
        };
    }
    
    _getBandwidthHistory(period) {
        const bandwidths = [];
        const prices = this.history.closes;
        for (let i = period; i < prices.length; i++) {
            const slice = prices.slice(i - period, i);
            const middle = slice.reduce((a, b) => a + b, 0) / period;
            const std = Math.sqrt(slice.reduce((sum, val) => sum + Math.pow(val - middle, 2), 0) / period);
            bandwidths.push((std * 4) / middle * 100);
        }
        return bandwidths;
    }
    
    calculateMACD(fast = this.config.MACD.FAST, 
                  slow = this.config.MACD.SLOW, 
                  signalPeriod = this.config.MACD.SIGNAL) {
        const prices = this.history.closes;
        if (prices.length < slow + signalPeriod) {
            return { macd: 0, signal: 0, histogram: 0, trend: 'NEUTRAL', cross: null, divergence: null };
        }
        
        const emaFast = this._calculateEMASeries(prices, fast);
        const emaSlow = this._calculateEMASeries(prices, slow);
        
        const macdLine = emaFast.map((v, i) => v - emaSlow[i]).filter(v => !isNaN(v));
        const signalLine = this._calculateEMASeries(macdLine, signalPeriod);
        const histogram = macdLine.slice(-signalLine.length).map((v, i) => v - signalLine[i]);
        
        const currentMACD = macdLine[macdLine.length - 1] || 0;
        const currentSignal = signalLine[signalLine.length - 1] || 0;
        const currentHist = histogram[histogram.length - 1] || 0;
        const prevHist = histogram[histogram.length - 2] || 0;
        
        let trend = 'NEUTRAL';
        if (currentMACD > currentSignal && currentHist > 0) trend = 'BULLISH';
        else if (currentMACD < currentSignal && currentHist < 0) trend = 'BEARISH';
        
        let cross = null;
        if (prevHist <= 0 && currentHist > 0) cross = 'BULLISH_CROSS';
        else if (prevHist >= 0 && currentHist < 0) cross = 'BEARISH_CROSS';
        
        const divergence = this._detectMACDDivergence(prices, macdLine);
        
        return {
            macd: parseFloat(currentMACD.toFixed(5)),
            signal: parseFloat(currentSignal.toFixed(5)),
            histogram: parseFloat(currentHist.toFixed(5)),
            trend,
            cross,
            divergence,
            momentum: currentHist > prevHist ? 'INCREASING' : 'DECREASING'
        };
    }
    
    _calculateEMASeries(data, period) {
        const k = 2 / (period + 1);
        const emas = [data[0]];
        for (let i = 1; i < data.length; i++) {
            emas.push(data[i] * k + emas[i - 1] * (1 - k));
        }
        return emas;
    }
    
    _detectMACDDivergence(prices, macdLine) {
        if (prices.length < 20) return null;
        
        const priceLows = prices.slice(-20);
        const macdLows = macdLine.slice(-20);
        
        const priceMin = Math.min(...priceLows);
        const priceMinIdx = priceLows.indexOf(priceMin);
        const macdAtPriceMin = macdLows[priceMinIdx];
        
        const prevPriceMin = Math.min(...prices.slice(-40, -20));
        const prevMacdMin = Math.min(...macdLine.slice(-40, -20));
        
        if (priceMin < prevPriceMin * 0.99 && macdAtPriceMin > prevMacdMin * 1.01) {
            return 'BULLISH_DIVERGENCE';
        }
        
        const priceMax = Math.max(...priceLows);
        const priceMaxIdx = priceLows.indexOf(priceMax);
        const macdAtPriceMax = macdLows[priceMaxIdx];
        
        const prevPriceMax = Math.max(...prices.slice(-40, -20));
        const prevMacdMax = Math.max(...macdLine.slice(-40, -20));
        
        if (priceMax > prevPriceMax * 1.01 && macdAtPriceMax < prevMacdMax * 0.99) {
            return 'BEARISH_DIVERGENCE';
        }
        
        return null;
    }
    
    calculateRSI(period = this.config.RSI.PERIOD) {
        const prices = this.history.closes;
        if (prices.length < period + 1) {
            return { value: 50, state: 'NEUTRAL', overbought: 70, oversold: 30, dynamic: this.config.RSI.DYNAMIC };
        }
        
        let gains = 0;
        let losses = 0;
        
        for (let i = 1; i <= period; i++) {
            const change = prices[prices.length - i] - prices[prices.length - i - 1];
            if (change > 0) gains += change;
            else losses -= change;
        }
        
        const avgGain = gains / period;
        const avgLoss = losses / period;
        
        let rs = avgGain / avgLoss;
        for (let i = period + 1; i < Math.min(prices.length, period * 2); i++) {
            const change = prices[prices.length - i] - prices[prices.length - i - 1];
            const gain = change > 0 ? change : 0;
            const loss = change < 0 ? -change : 0;
            rs = ((rs * (period - 1)) + (gain / Math.max(loss, 0.0001))) / period;
        }
        
        const rsi = 100 - (100 / (1 + rs));
        
        let overbought = this.config.RSI.OVERBOUGHT;
        let oversold = this.config.RSI.OVERSOLD;
        
        if (this.config.RSI.DYNAMIC) {
            const atr = this.calculateATR(14);
            const atrPercent = atr ? (atr / prices[prices.length - 1]) * 100 : 1;
            overbought = Math.min(80, 70 + atrPercent * 2);
            oversold = Math.max(20, 30 - atrPercent * 2);
        }
        
        let state = 'NEUTRAL';
        if (rsi > overbought) state = 'OVERBOUGHT';
        else if (rsi < oversold) state = 'OVERSOLD';
        
        return {
            value: parseFloat(rsi.toFixed(2)),
            state,
            overbought: parseFloat(overbought.toFixed(1)),
            oversold: parseFloat(oversold.toFixed(1)),
            dynamic: this.config.RSI.DYNAMIC
        };
    }
    
    calculateADX(period = this.config.ADX.PERIOD) {
        const highs = this.history.highs;
        const lows = this.history.lows;
        const closes = this.history.closes;
        
        if (highs.length < period * 2) {
            return { adx: 25, diPlus: 50, diMinus: 50, trend: 'RANGE', strength: 'MODERATE' };
        }
        
        const tr = [];
        const plusDM = [];
        const minusDM = [];
        
        for (let i = 1; i < highs.length; i++) {
            const tr1 = highs[i] - lows[i];
            const tr2 = Math.abs(highs[i] - closes[i - 1]);
            const tr3 = Math.abs(lows[i] - closes[i - 1]);
            tr.push(Math.max(tr1, tr2, tr3));
            
            const upMove = highs[i] - highs[i - 1];
            const downMove = lows[i - 1] - lows[i];
            
            if (upMove > downMove && upMove > 0) plusDM.push(upMove);
            else plusDM.push(0);
            
            if (downMove > upMove && downMove > 0) minusDM.push(downMove);
            else minusDM.push(0);
        }
        
        const atr = MathUtils.sma(tr, period) || 1;
        const plusDI = 100 * MathUtils.sma(plusDM, period) / atr;
        const minusDI = 100 * MathUtils.sma(minusDM, period) / atr;
        const dx = 100 * Math.abs(plusDI - minusDI) / (plusDI + minusDI + 0.001);
        const adx = MathUtils.sma([dx], period) || 25;
        
        let trend = 'RANGE';
        if (adx > 25) trend = plusDI > minusDI ? 'STRONG_UP' : 'STRONG_DOWN';
        else if (adx > 20) trend = plusDI > minusDI ? 'UP' : 'DOWN';
        
        return {
            adx: parseFloat(adx.toFixed(2)),
            diPlus: parseFloat(plusDI.toFixed(2)),
            diMinus: parseFloat(minusDI.toFixed(2)),
            trend,
            strength: adx > 40 ? 'VERY_STRONG' : adx > 25 ? 'STRONG' : adx > 20 ? 'MODERATE' : 'WEAK'
        };
    }
    
    calculateATR(period = this.config.ATR.PERIOD) {
        const highs = this.history.highs;
        const lows = this.history.lows;
        const closes = this.history.closes;
        
        if (highs.length < period + 1) return 0.001;
        
        const tr = [];
        for (let i = 1; i < highs.length; i++) {
            const tr1 = highs[i] - lows[i];
            const tr2 = Math.abs(highs[i] - closes[i - 1]);
            const tr3 = Math.abs(lows[i] - closes[i - 1]);
            tr.push(Math.max(tr1, tr2, tr3));
        }
        
        return parseFloat((MathUtils.sma(tr, period) || 0.001).toFixed(5));
    }
    
    calculateVWAP() {
        const prices = this.history.closes;
        const volumes = this.history.volumes;
        
        if (prices.length === 0 || volumes.length === 0) return { value: prices[prices.length - 1] || 100, position: 'ABOVE', deviation: 0 };
        
        let cumulativeTPV = 0;
        let cumulativeVol = 0;
        
        for (let i = 0; i < prices.length; i++) {
            cumulativeTPV += prices[i] * volumes[i];
            cumulativeVol += volumes[i];
        }
        
        const vwap = cumulativeVol > 0 ? cumulativeTPV / cumulativeVol : prices[prices.length - 1];
        const currentPrice = prices[prices.length - 1];
        
        return {
            value: parseFloat(vwap.toFixed(5)),
            position: currentPrice > vwap ? 'ABOVE' : 'BELOW',
            deviation: parseFloat(((currentPrice - vwap) / vwap * 100).toFixed(2))
        };
    }
    
    getAllSignals() {
        const bollinger = this.calculateBollinger();
        const macd = this.calculateMACD();
        const rsi = this.calculateRSI();
        const adx = this.calculateADX();
        const atr = this.calculateATR();
        const vwap = this.calculateVWAP();
        
        const signals = [];
        
        if (macd.cross === 'BULLISH_CROSS') signals.push('MACD_BULL_CROSS');
        if (macd.cross === 'BEARISH_CROSS') signals.push('MACD_BEAR_CROSS');
        if (macd.divergence === 'BULLISH_DIVERGENCE') signals.push('MACD_BULL_DIV');
        if (macd.divergence === 'BEARISH_DIVERGENCE') signals.push('MACD_BEAR_DIV');
        
        if (rsi.state === 'OVERSOLD') signals.push('RSI_OVERSOLD');
        if (rsi.state === 'OVERBOUGHT') signals.push('RSI_OVERBOUGHT');
        
        if (bollinger.squeeze) signals.push('BOLLINGER_SQUEEZE');
        if (bollinger.signal === 'BREAKOUT_UP') signals.push('BB_BREAKOUT_UP');
        if (bollinger.signal === 'BREAKOUT_DOWN') signals.push('BB_BREAKOUT_DOWN');
        
        if (adx.trend.includes('STRONG')) signals.push(`ADX_${adx.trend}`);
        
        let momentumScore = 0;
        if (macd.trend === 'BULLISH') momentumScore += 25;
        if (macd.trend === 'BEARISH') momentumScore -= 25;
        if (rsi.state === 'OVERSOLD') momentumScore += 20;
        if (rsi.state === 'OVERBOUGHT') momentumScore -= 20;
        if (bollinger.position > 0.8) momentumScore -= 15;
        if (bollinger.position < 0.2) momentumScore += 15;
        if (adx.trend === 'STRONG_UP') momentumScore += 20;
        if (adx.trend === 'STRONG_DOWN') momentumScore -= 20;
        
        return {
            bollinger,
            macd,
            rsi,
            adx,
            atr,
            vwap,
            signals,
            momentumScore: Math.max(-100, Math.min(100, momentumScore)),
            timestamp: Date.now()
        };
    }
}

window.TechnicalIndicators = TechnicalIndicators;
console.log('✅ Parte 2/5 cargada: Indicadores Técnicos Avanzados');


/**
 * MARKET BRIDGE QUANTUM MACRO V27 UNIFIED - PARTE 3/5
 * Sistema de Machine Learning: LSTM, Ensemble, Regímenes, Bayesian
 */

class FrozenBackbone {
    constructor() {
        this.model = null;
        this.isFrozen = false;
        this.inputShape = null;
    }
    
    async loadOrBuild(inputShape, weightsUrl = null) {
        this.inputShape = inputShape;
        
        if (weightsUrl && window.tf) {
            try {
                this.model = await tf.loadLayersModel(weightsUrl);
                this.freeze();
                console.log('🧠 [LSTM] Modelo cargado desde URL');
                return this.model;
            } catch (e) {
                console.warn('🧠 [LSTM] No se pudo cargar modelo, construyendo nuevo...');
            }
        }
        
        if (!window.tf) {
            console.warn('🧠 [LSTM] TensorFlow no disponible');
            return null;
        }
        
        console.log('🧠 [LSTM] Construyendo arquitectura LSTM...');
        
        const inputs = tf.input({shape: inputShape});
        
        const encoder = tf.layers.lstm({
            units: V27_CONFIG.ML.LSTM.UNITS,
            returnState: true,
            name: 'encoder_lstm'
        }).apply(inputs);
        
        const [encoderOutput, stateH, stateC] = encoder;
        
        const decoder = tf.layers.lstm({
            units: V27_CONFIG.ML.LSTM.UNITS,
            returnSequences: true,
            name: 'decoder_lstm'
        }).apply(encoderOutput, {initialState: [stateH, stateC]});
        
        const attention = tf.layers.attention().apply([decoder, encoderOutput]);
        
        const dense1 = tf.layers.dense({
            units: 64, 
            activation: 'relu',
            name: 'dense_1'
        }).apply(attention);
        
        const dropout = tf.layers.dropout({
            rate: V27_CONFIG.ML.LSTM.DROPOUT
        }).apply(dense1);
        
        const direction = tf.layers.dense({
            units: 1,
            activation: 'sigmoid',
            name: 'direction'
        }).apply(dropout);
        
        const projection = tf.layers.dense({
            units: 4,
            activation: 'linear',
            name: 'projection'
        }).apply(dropout);
        
        this.model = tf.model({inputs, outputs: [direction, projection]});
        
        this.model.compile({
            optimizer: tf.train.adam(V27_CONFIG.ML.LSTM.LEARNING_RATE),
            loss: {
                direction: 'binaryCrossentropy',
                projection: 'meanSquaredError'
            },
            lossWeights: { direction: 0.7, projection: 0.3 },
            metrics: ['accuracy']
        });
        
        this.freeze();
        console.log('🧠 [LSTM] Modelo construido y congelado');
        return this.model;
    }
    
    freeze() {
        if (!this.model) return;
        this.model.layers.forEach(layer => {
            if (!['direction', 'projection'].includes(layer.name)) {
                layer.trainable = false;
            }
        });
        this.isFrozen = true;
        console.log('🧠 [LSTM] Backbone congelado');
    }
    
    /**
     * Método predict adaptado para BayesianEnsemble
     * Devuelve un número simple (probabilidad 0-1) en lugar de tensores
     */
    predict(input) {
        if (!this.model) {
            console.warn('🧠 [LSTM] Modelo no inicializado, devolviendo 0.5');
            return 0.5;
        }
        
        try {
            console.log('🧠 [LSTM] Prediciendo...');
            
            // Hacer predicción - devuelve [direction, projection]
            const outputs = this.model.predict(input);
            
            // Extraer direction (primera salida)
            const directionTensor = Array.isArray(outputs) ? outputs[0] : outputs;
            
            // Convertir a número
            let probability;
            if (directionTensor && typeof directionTensor.dataSync === 'function') {
                probability = directionTensor.dataSync()[0];
            } else if (typeof directionTensor === 'number') {
                probability = directionTensor;
            } else if (Array.isArray(directionTensor)) {
                probability = directionTensor[0];
            } else {
                probability = 0.5;
            }
            
            console.log('🧠 [LSTM] Probabilidad:', (probability * 100).toFixed(1) + '%');
            
            // Limpiar memoria de tensores
            if (Array.isArray(outputs)) {
                outputs.forEach(t => t && t.dispose && t.dispose());
            } else if (outputs && outputs.dispose) {
                outputs.dispose();
            }
            
            return probability;
            
        } catch (e) {
            console.error('🧠 [LSTM] Error en predict:', e);
            return 0.5;
        }
    }
}

class BayesianEnsemble {
    constructor() {
        this.models = new Map();
        this.priors = new Map();
        this.performances = new Map();
        this.uncertainties = new Map();
    }
    
    addModel(name, model, priorWeight = 1.0) {
        this.models.set(name, model);
        this.priors.set(name, priorWeight);
        this.performances.set(name, { hits: 0, total: 0, recentErrors: [] });
        this.uncertainties.set(name, 1.0);
    }
    
    async predict(data) {
    const predictions = new Map();
    
    for (const [name, model] of this.models) {
        try {
            let prob = 0.5;
            
            if (model && typeof model.predict === 'function') {
                console.log(`🧠 [Ensemble] Llamando modelo ${name}...`);
                
                const rawPred = model.predict(data);
                
                // Manejar diferentes tipos de retorno de forma segura
                if (typeof rawPred === 'number') {
                    prob = rawPred;
                    console.log(`🧠 [Ensemble] ${name} devolvió número: ${prob.toFixed(3)}`);
                } else if (rawPred && typeof rawPred.then === 'function') {
                    // Es una promesa
                    const resolved = await rawPred;
                    prob = typeof resolved === 'number' ? resolved : 
                           (resolved && resolved[0]) || 0.5;
                    console.log(`🧠 [Ensemble] ${name} promesa resuelta: ${prob.toFixed(3)}`);
                } else if (Array.isArray(rawPred)) {
                    prob = rawPred[0];
                    console.log(`🧠 [Ensemble] ${name} array: ${prob.toFixed(3)}`);
                } else if (rawPred && typeof rawPred.dataSync === 'function') {
                    // Es un tensor de TensorFlow
                    const values = rawPred.dataSync();
                    prob = values[0];
                    console.log(`🧠 [Ensemble] ${name} tensor: ${prob.toFixed(3)}`);
                    // Limpiar tensor si es necesario
                    if (rawPred.dispose) rawPred.dispose();
                } else {
                    console.warn(`🧠 [Ensemble] ${name} formato desconocido:`, rawPred);
                    prob = 0.5;
                }
            }
            
            // Asegurar que prob es un número válido
            prob = isNaN(prob) ? 0.5 : Math.max(0, Math.min(1, prob));
            
            const uncertainty = this._calculateUncertainty(prob);
            predictions.set(name, { prob, uncertainty });
            this.uncertainties.set(name, uncertainty);
            
        } catch (e) {
            console.error(`🧠 [Ensemble] Error en modelo ${name}:`, e);
            predictions.set(name, { prob: 0.5, uncertainty: 1.0 });
        }
    }
    
    const weights = this.getWeights();
    
    let ensembleProb = 0;
    let totalWeight = 0;
    
    for (const [name, { prob, uncertainty }] of predictions) {
        const weight = weights.get(name) || 0;
        const precisionWeight = weight * (1 / (1 + uncertainty));
        ensembleProb += prob * precisionWeight;
        totalWeight += precisionWeight;
    }
    
    ensembleProb = totalWeight > 0 ? ensembleProb / totalWeight : 0.5;
    const variance = this._calculateEnsembleVariance(predictions, weights, ensembleProb);
    const calibratedProb = this._temperatureScaling(ensembleProb, V27_CONFIG.ML.ENSEMBLE.TEMPERATURE_BETA);
    
    console.log(`🧠 [Ensemble] Resultado final: ${(calibratedProb*100).toFixed(1)}%`);
    
    return {
        probability: calibratedProb,
        direction: calibratedProb > 0.68 ? 'BUY' : calibratedProb < 0.32 ? 'SELL' : 'NEUTRAL',
        confidence: 1 - Math.sqrt(variance),
        uncertainty: Math.sqrt(variance),
        modelContributions: Object.fromEntries(weights),
        rawPredictions: Object.fromEntries(predictions),
        timestamp: Date.now()
    };
}
    
    getWeights() {
        const weights = new Map();
        let totalPrecision = 0;
        
        for (const [name, performance] of this.performances) {
            const accuracy = performance.total > 0 ? performance.hits / performance.total : 0.5;
            const uncertainty = this.uncertainties.get(name) || 1.0;
            const prior = this.priors.get(name) || 1.0;
            const precision = (accuracy + 0.01) / (uncertainty + 0.01) * prior;
            weights.set(name, precision);
            totalPrecision += precision;
        }
        
        for (const name of weights.keys()) {
            weights.set(name, totalPrecision > 0 ? weights.get(name) / totalPrecision : 1 / weights.size);
        }
        
        return weights;
    }
    
    update(name, predicted, actual) {
        const perf = this.performances.get(name);
        if (!perf) return;
        
        perf.total++;
        const isHit = (predicted === 'BUY' && actual === 'A') || (predicted === 'SELL' && actual === 'B');
        if (isHit) perf.hits++;
        
        perf.recentErrors.push(isHit ? 0 : 1);
        if (perf.recentErrors.length > 50) perf.recentErrors.shift();
        
        if (perf.recentErrors.length > 10) {
            const mean = perf.recentErrors.reduce((a, b) => a + b, 0) / perf.recentErrors.length;
            const variance = perf.recentErrors.reduce((sum, e) => sum + Math.pow(e - mean, 2), 0) / perf.recentErrors.length;
            this.uncertainties.set(name, Math.sqrt(variance) + 0.1);
        }
    }
    
    _calculateUncertainty(prediction) {
        const p = prediction;
        if (p <= 0 || p >= 1) return 0;
        return -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
    }
    
    _calculateEnsembleVariance(predictions, weights, ensembleMean) {
        let variance = 0;
        for (const [name, { prob }] of predictions) {
            const w = weights.get(name) || 0;
            variance += w * Math.pow(prob - ensembleMean, 2);
        }
        return variance;
    }
    
    _temperatureScaling(prob, temperature) {
        const logit = Math.log(prob / (1 - prob));
        const scaledLogit = logit / temperature;
        return 1 / (1 + Math.exp(-scaledLogit));
    }
}

class RegimeDetector {
    constructor() {
        this.currentRegime = 'RANGE';
        this.volatilityHistory = [];
        this.trendHistory = [];
    }
    
    detect(volatility, trend, adx) {
        this.volatilityHistory.push(volatility);
        this.trendHistory.push(trend);
        
        if (this.volatilityHistory.length > 100) {
            this.volatilityHistory.shift();
            this.trendHistory.shift();
        }
        
        const avgVol = this.volatilityHistory.reduce((a, b) => a + b, 0) / this.volatilityHistory.length;
        const volPercentile = this._calculatePercentile(this.volatilityHistory, volatility);
        
        let newRegime = 'RANGE';
        
        if (volPercentile > 0.9 || volatility > V27_CONFIG.RISK.CRISIS_VOL_THRESHOLD) {
            newRegime = 'CRISIS';
        } else if (volPercentile > 0.7) {
            newRegime = 'HIGH_VOL';
        } else if (adx > 30 && Math.abs(trend) > 0.5) {
            newRegime = 'TREND';
        }
        
        if (newRegime !== this.currentRegime) {
            this.currentRegime = newRegime;
        }
        
        return {
            regime: this.currentRegime,
            confidence: this._calculateRegimeConfidence(),
            volatility: avgVol,
            trendStrength: adx,
            timestamp: Date.now()
        };
    }
    
    _calculatePercentile(data, value) {
        const sorted = [...data].sort((a, b) => a - b);
        const index = sorted.findIndex(v => v >= value);
        return index / sorted.length;
    }
    
    _calculateRegimeConfidence() {
        if (this.volatilityHistory.length < 20) return 0.5;
        const recent = this.volatilityHistory.slice(-20);
        const variance = MathUtils.stdDev(recent, recent.length);
        return Math.max(0, Math.min(1, 1 - (variance / 10)));
    }
}

class ProjectionDriftDetector {
    constructor(windowSize = 100, alpha = 0.05) {
        this.errors = [];
        this.windowSize = windowSize;
        this.alpha = alpha;
    }
    
    addError(error) {
        this.errors.push(error);
        if (this.errors.length > this.windowSize * 2) {
            this.errors.shift();
        }
    }
    
    detect() {
        if (this.errors.length < this.windowSize) return false;
        
        const recent = this.errors.slice(-this.windowSize);
        const baseline = this.errors.slice(-this.windowSize * 2, -this.windowSize);
        
        if (baseline.length < this.windowSize) return false;
        
        const ksStatistic = MathUtils.ksTest(recent, baseline);
        const criticalValue = 1.36 / Math.sqrt(this.windowSize);
        
        return ksStatistic > criticalValue;
    }
    
    reset() {
        this.errors = [];
    }
}

window.FrozenBackbone = FrozenBackbone;
window.BayesianEnsemble = BayesianEnsemble;
window.RegimeDetector = RegimeDetector;
window.ProjectionDriftDetector = ProjectionDriftDetector;

console.log('✅ Parte 3/5 cargada: Sistema ML Avanzado');


/**
 * MARKET BRIDGE QUANTUM MACRO V27 UNIFIED - PARTE 4/5
 * Detección de Trampas MANUAL (Basada en TU INPUT), Adversarial Shield, Microestructura
 */

// ═══════════════════════════════════════════════════════════════════════════════
// DETECTOR DE SEMILLA - Analiza TU secuencia de A/B que introduces manualmente
// ═══════════════════════════════════════════════════════════════════════════════

class SeedChangeDetector {
    constructor() {
        this.historyAnalysis = [];
        this.patterns = new Map();
        this.lastSequenceHash = null;
        this.manipulationScore = 0;
    }
    
    detect(sequence) {
        if (!sequence || sequence.length < 15) return { score: 0, isManipulated: false, details: {} };
        
        const binarySeq = sequence.map(s => s.val === 'A' ? 1 : 0);
        const vals = sequence.map(s => s.val);
        
        // 1. Frecuencia esperada vs real (Chi-square test simplificado)
        const counts = { A: 0, B: 0 };
        vals.forEach(v => { if (v) counts[v]++; });
        const total = vals.length;
        const expected = total / 2;
        const chiSquare = Math.pow(counts.A - expected, 2) / expected + Math.pow(counts.B - expected, 2) / expected;
        const freqAnomaly = chiSquare > 3.84; // p < 0.05
        
        // 2. Test de rachas (Runs Test)
        let runs = 1;
        let maxRun = 1;
        let currentRun = 1;
        for (let i = 1; i < vals.length; i++) {
            if (vals[i] === vals[i-1]) {
                currentRun++;
                maxRun = Math.max(maxRun, currentRun);
            } else {
                runs++;
                currentRun = 1;
            }
        }
        
        const expectedRuns = (2 * counts.A * counts.B) / total + 1;
        const runsVariance = (2 * counts.A * counts.B * (2 * counts.A * counts.B - total)) / (total * total * (total - 1));
        const runsZScore = Math.abs(runs - expectedRuns) / Math.sqrt(runsVariance || 1);
        const runsAnomaly = runsZScore > 1.96 || maxRun > 7; // |z| > 1.96 o racha > 7
        
        // 3. Detección de ciclos (periodicidad en tu secuencia)
        const cycles = this._detectCycles(binarySeq);
        
        // 4. Entropía de Shannon (aleatoriedad)
        const pA = counts.A / total;
        const pB = counts.B / total;
        const entropy = -(pA * Math.log2(pA || 0.001) + pB * Math.log2(pB || 0.001));
        const normalizedEntropy = entropy / 1; // Max entropy = 1 para binario
        const lowEntropy = normalizedEntropy < 0.75;
        
        // 5. Repetición de patrones históricos (¿esta secuencia ya ocurrió?)
        const currentHash = vals.slice(-10).join('');
        const patternRepeat = this._checkPatternRepeat(vals, currentHash);
        
        // Score compuesto (0-1)
        let score = 0;
        if (freqAnomaly) score += 0.20;
        if (runsAnomaly) score += 0.25;
        if (cycles.detected) score += 0.25;
        if (lowEntropy) score += 0.15;
        if (patternRepeat.isRepeating) score += 0.15;
        
        this.manipulationScore = score;
        
        return {
            score: Math.min(1, score),
            isManipulated: score > 0.60,
            details: {
                chiSquare: chiSquare.toFixed(2),
                runsZScore: runsZScore.toFixed(2),
                maxConsecutive: maxRun,
                cycles: cycles.periods.map(p => `P${p.period}(${p.strength.toFixed(2)})`).join(', '),
                entropy: normalizedEntropy.toFixed(3),
                patternRepeat: patternRepeat.repetitionRate.toFixed(2)
            }
        };
    }
    
    _detectCycles(seq) {
        const periods = [];
        const maxPeriod = Math.min(15, Math.floor(seq.length / 3));
        
        for (let p = 2; p <= maxPeriod; p++) {
            let matches = 0;
            for (let i = p; i < seq.length; i++) {
                if (seq[i] === seq[i - p]) matches++;
            }
            const strength = matches / (seq.length - p);
            if (strength > 0.60) periods.push({ period: p, strength });
        }
        
        return {
            detected: periods.length > 0,
            periods: periods.sort((a, b) => b.strength - a.strength).slice(0, 2)
        };
    }
    
    _checkPatternRepeat(fullSeq, currentHash) {
        if (fullSeq.length < 20) return { isRepeating: false, repetitionRate: 0 };
        
        const historical = fullSeq.slice(0, -10).join('');
        const matches = (historical.match(new RegExp(currentHash, 'g')) || []).length;
        
        return {
            isRepeating: matches > 0,
            repetitionRate: matches / (historical.length / 10)
        };
    }
    
    learn(sequence, wasTrap) {
        if (!sequence || sequence.length < 10) return;
        const hash = sequence.slice(-10).map(s => s.val).join('');
        const existing = this.patterns.get(hash) || { count: 0, traps: 0 };
        existing.count++;
        if (wasTrap) existing.traps++;
        this.patterns.set(hash, existing);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETECTOR DE TEMPO - Analiza TUS tiempos entre clicks (sin WebSocket externo)
// ═══════════════════════════════════════════════════════════════════════════════

class BrokerTempoDetector {
    constructor() {
        this.userTimestamps = [];      // Cuándo hiciste clicks
        this.intervals = [];           // Intervalos entre tus acciones
        this.resultDelays = [];        // "Delay" simulado entre tu click y resultado
        this.patternRegularity = 0;
    }
    
    recordUserAction(timestamp = Date.now()) {
        this.userTimestamps.push(timestamp);
        if (this.userTimestamps.length > 30) this.userTimestamps.shift();
        
        // Calcular intervalo desde última acción
        if (this.userTimestamps.length > 1) {
            const interval = timestamp - this.userTimestamps[this.userTimestamps.length - 2];
            this.intervals.push(interval);
            if (this.intervals.length > 20) this.intervals.shift();
        }
    }
    
    recordResult(timestamp = Date.now()) {
        // En modo manual, simulamos que el resultado "llega" inmediatamente
        // pero registramos el tiempo para análisis de patrón
        this.resultDelays.push(0);
        if (this.resultDelays.length > 20) this.resultDelays.shift();
    }
    
    check() {
        if (this.intervals.length < 5) return { score: 0, isSuspicious: false, details: {} };
        
        const recent = this.intervals.slice(-10);
        
        // 1. Coeficiente de variación (CV) - ¿siempre tardas lo mismo?
        const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
        const variance = recent.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / recent.length;
        const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
        
        // CV < 0.1 = muy regular (sospechoso para humano)
        // CV > 0.5 = irregular (normal para humano)
        const roboticPattern = cv < 0.15 && mean > 500; // Si tardas >500ms y siempre igual
        
        // 2. Detección de "burst" (rápido lento rápido)
        const acceleration = [];
        for (let i = 2; i < recent.length; i++) {
            const prevChange = recent[i-1] - recent[i-2];
            const currChange = recent[i] - recent[i-1];
            if (Math.sign(prevChange) !== Math.sign(currChange)) {
                acceleration.push(Math.abs(currChange));
            }
        }
        const erratic = acceleration.length > recent.length * 0.6;
        
        // 3. Tiempo absoluto muy corto (< 200ms = posiblemente automatizado)
        const tooFast = recent.some(i => i < 200);
        
        let score = 0;
        if (roboticPattern) score += 0.5;
        if (erratic) score += 0.3;
        if (tooFast) score += 0.2;
        
        return {
            score: Math.min(1, score),
            isSuspicious: score > 0.5,
            details: {
                avgInterval: Math.round(mean),
                cv: cv.toFixed(3),
                robotic: roboticPattern ? 'SI' : 'NO',
                tooFast: tooFast ? 'SI' : 'NO',
                pattern: erratic ? 'ERRATICO' : 'ESTABLE'
            }
        };
    }
    
    reset() {
        this.userTimestamps = [];
        this.intervals = [];
        this.resultDelays = [];
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MICROESTRUCTURA BASADA EN TUS TRADES - Analiza TU comportamiento de trading
// ═══════════════════════════════════════════════════════════════════════════════

class MicrostructureAnalyzer {
    constructor() {
        this.yourTrades = [];          // Tus operaciones: { direction, stake, result, time }
        this.virtualImbalance = 0;     // Sesgo de tus operaciones
        this.trapPatterns = [];        // Patrones donde perdiste
    }
    
    recordYourTrade(direction, stake, timestamp = Date.now()) {
        this.yourTrades.push({
            direction, // 'A' o 'B'
            stake,
            timestamp,
            result: null, // Se llena después con processTradeResult
            wasInverted: false
        });
        
        if (this.yourTrades.length > 50) this.yourTrades.shift();
        this._updateImbalance();
    }
    
    recordResult(result, wasInverted = false) {
        if (this.yourTrades.length === 0) return;
        const last = this.yourTrades[this.yourTrades.length - 1];
        last.result = result;
        last.wasInverted = wasInverted;
        
        // Si perdiste, guardar patrón de trampa
        if (last.direction !== result) {
            this.trapPatterns.push({
                direction: last.direction,
                stake: last.stake,
                time: last.timestamp,
                recentSequence: window.sequence ? window.sequence.slice(-5).map(s => s.val).join('') : ''
            });
            if (this.trapPatterns.length > 20) this.trapPatterns.shift();
        }
    }
    
    _updateImbalance() {
        const recent = this.yourTrades.slice(-10);
        const buyVol = recent.filter(t => t.direction === 'A').reduce((a, b) => a + b.stake, 0);
        const sellVol = recent.filter(t => t.direction === 'B').reduce((a, b) => a + b.stake, 0);
        const total = buyVol + sellVol;
        this.virtualImbalance = total > 0 ? (buyVol - sellVol) / total : 0;
    }
    
    calculateOBI() {
        const recent = this.yourTrades.slice(-10);
        const buyVol = recent.filter(t => t.direction === 'A').reduce((a, b) => a + b.stake, 0);
        const sellVol = recent.filter(t => t.direction === 'B').reduce((a, b) => a + b.stake, 0);
        
        return {
            obi: parseFloat(this.virtualImbalance.toFixed(3)),
            yourBuyVolume: buyVol,
            yourSellVolume: sellVol,
            ratio: sellVol > 0 ? (buyVol / sellVol).toFixed(2) : '∞',
            signal: this.virtualImbalance > 0.3 ? 'TU_BIAS_COMPRA' : 
                    this.virtualImbalance < -0.3 ? 'TU_BIAS_VENTA' : 'EQUILIBRADO'
        };
    }
    
    // DETECCIÓN DE TRAMPA basada en TU historial
    detectSpoofing() {
        const completed = this.yourTrades.filter(t => t.result !== null);
        if (completed.length < 5) return { detected: false, confidence: 0, details: {} };
        
        const recent = completed.slice(-10);
        
        // 1. Tasa de trampas (operaciones que perdiste)
        const traps = recent.filter(t => t.direction !== t.result);
        const trapRate = traps.length / recent.length;
        
        // 2. ¿Tus operaciones grandes siempre pierden? (Cebo)
        const bigTrades = recent.filter(t => t.stake >= 20);
        const bigTraps = bigTrades.filter(t => t.direction !== t.result);
        const bigTrapRate = bigTrades.length > 0 ? bigTraps.length / bigTrades.length : 0;
        
        // 3. ¿Tus últimas operaciones fueron todas contrarias al mercado?
        const last5 = recent.slice(-5);
        const wrongDirection = last5.filter(t => t.direction !== t.result).length;
        const consistentTrap = wrongDirection >= 4;
        
        // 4. Análisis de "cebo": ¿ganas pequeño, pierdes grande?
        const wins = recent.filter(t => t.direction === t.result);
        const losses = recent.filter(t => t.direction !== t.result);
        const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b.stake, 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b.stake, 0) / losses.length : 0;
        const baitPattern = avgLoss > avgWin * 1.5 && wins.length > 0;
        
        // 5. ¿Estás en racha de pérdidas consecutivas?
        let consecutiveLosses = 0;
        for (let i = recent.length - 1; i >= 0; i--) {
            if (recent[i].direction !== recent[i].result) consecutiveLosses++;
            else break;
        }
        
        let score = 0;
        if (trapRate > 0.60) score += 0.30;
        if (bigTrapRate > 0.70) score += 0.25;
        if (consistentTrap) score += 0.25;
        if (baitPattern) score += 0.15;
        if (consecutiveLosses >= 3) score += 0.15;
        
        return {
            detected: score > 0.60,
            confidence: score,
            type: score > 0.80 ? 'CEBO_AGRESIVO' : score > 0.60 ? 'MANIPULACION' : 'NORMAL',
            details: {
                trapRate: (trapRate * 100).toFixed(0) + '%',
                bigTrapRate: (bigTrapRate * 100).toFixed(0) + '%',
                consecutiveLosses: consecutiveLosses,
                baitPattern: baitPattern ? 'SI' : 'NO',
                yourBias: this.virtualImbalance > 0.2 ? 'COMPRADOR' : 
                         this.virtualImbalance < -0.2 ? 'VENDEDOR' : 'NEUTRO'
            }
        };
    }
    
    getImbalanceTrend() {
        if (this.yourTrades.length < 6) return 'INSUFICIENTE';
        
        const firstHalf = this.yourTrades.slice(0, Math.floor(this.yourTrades.length / 2));
        const secondHalf = this.yourTrades.slice(Math.floor(this.yourTrades.length / 2));
        
        const buy1 = firstHalf.filter(t => t.direction === 'A').length;
        const buy2 = secondHalf.filter(t => t.direction === 'A').length;
        
        if (buy2 > buy1 * 1.5) return 'AUMENTANDO_COMPRA';
        if (buy2 < buy1 * 0.5) return 'AUMENTANDO_VENTA';
        return 'ESTABLE';
    }
    
    reset() {
        this.yourTrades = [];
        this.virtualImbalance = 0;
        this.trapPatterns = [];
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXTUAL LABELING ENGINE (existente, optimizado para modo manual)
// ═══════════════════════════════════════════════════════════════════════════════

class ContextualLabelingEngine {
    constructor() {
        this.trapDatabase = [];
        this.normalDatabase = [];
        this.thresholds = { anomaly: 2.0, contextual: 0.7 }; // Umbral ajustado para datos manuales
    }
    
    extractFeatures(window) {
        const vals = window.map(w => w.val);
        const binary = vals.map(v => v === 'A' ? 1 : 0);
        
        // Features basados en tu secuencia manual
        return {
            // Frecuencia relativa
            freqA: vals.filter(v => v === 'A').length / vals.length,
            
            // Racha máxima
            maxStreak: this._maxConsecutive(vals),
            
            // Cambios de dirección
            reversals: this._countReversals(binary),
            
            // "Volatilidad" de tu secuencia (cambios frecuentes)
            volatility: this._calculateVolatility(binary),
            
            // Últimos 3 vs primeros 3 (tendencia)
            trend: this._calculateTrend(binary),
            
            // Timestamp features
            timeOfDay: new Date().getHours(),
            dayOfWeek: new Date().getDay()
        };
    }
    
    _maxConsecutive(vals) {
        if (vals.length < 2) return 1;
        let max = 1, current = 1;
        for (let i = 1; i < vals.length; i++) {
            if (vals[i] === vals[i-1]) {
                current++;
                max = Math.max(max, current);
            } else {
                current = 1;
            }
        }
        return max;
    }
    
    _countReversals(binary) {
        let count = 0;
        for (let i = 1; i < binary.length; i++) {
            if (binary[i] !== binary[i-1]) count++;
        }
        return count;
    }
    
    _calculateVolatility(binary) {
        if (binary.length < 2) return 0;
        const changes = [];
        for (let i = 1; i < binary.length; i++) {
            changes.push(Math.abs(binary[i] - binary[i-1]));
        }
        const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
        const variance = changes.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / changes.length;
        return Math.sqrt(variance);
    }
    
    _calculateTrend(binary) {
        if (binary.length < 6) return 0;
        const first = binary.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        const last = binary.slice(-3).reduce((a, b) => a + b, 0) / 3;
        return last - first;
    }
    
    isAnomaly(features) {
        // Para modo manual, comparamos con distribución esperada de binario aleatorio
        const zScores = {};
        
        // Frecuencia A esperada: 0.5, desviación esperada para n=20: ~0.11
        if (typeof features.freqA === 'number') {
            zScores.freqA = Math.abs(features.freqA - 0.5) / 0.11;
        }
        
        // Racha máxima esperada en secuencia aleatoria: ~log2(n) + 1
        const expectedMaxStreak = Math.log2(20) + 1;
        if (typeof features.maxStreak === 'number') {
            zScores.maxStreak = Math.max(0, features.maxStreak - expectedMaxStreak) / 2;
        }
        
        // Volatilidad esperada para binario: ~0.5
        if (typeof features.volatility === 'number') {
            zScores.volatility = Math.abs(features.volatility - 0.5) / 0.2;
        }
        
        const maxZ = Math.max(...Object.values(zScores));
        return maxZ > this.thresholds.anomaly;
    }
    
    _calculateZScores(features) {
        // Versión simplificada para modo manual
        return {
            freqA: Math.abs((features.freqA || 0.5) - 0.5) * 10,
            maxStreak: (features.maxStreak || 3) / 3,
            volatility: Math.abs((features.volatility || 0.5) - 0.5) * 5
        };
    }
    
    label(window, actualOutcome) {
        const features = this.extractFeatures(window);
        
        // En modo manual, una "trampa" es: predicción ≠ resultado + features anómalos
        const isTrap = actualOutcome === 'LOSS' && this.isAnomaly(features);
        
        if (isTrap) {
            this.trapDatabase.push({ features, timestamp: Date.now() });
        } else {
            this.normalDatabase.push({ features, timestamp: Date.now() });
        }
        
        // Limitar tamaño
        if (this.trapDatabase.length > 200) this.trapDatabase.shift();
        if (this.normalDatabase.length > 500) this.normalDatabase.shift();
        
        return { isTrap, features };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADVERSARIAL SHIELD V27 COMPLETO - MODO MANUAL (funciona con TU INPUT)
// ═══════════════════════════════════════════════════════════════════════════════

class AdversarialShield {
    constructor() {
        console.log('🛡️ [Shield] Constructor llamado - Cargando estado...');
        
        // Intentar cargar estado previo
        const savedState = this._loadState();
        
        this.detectors = {
            anomaly: new ContextualLabelingEngine(),
            seedChange: new SeedChangeDetector(),
            brokerTempo: new BrokerTempoDetector(),
            microstructure: new MicrostructureAnalyzer()
        };
        
        this.votingThreshold = 0.50;
        this.inversionThreshold = 0.65;
        this.lastProjections = [];
        
        // ========== NUEVO: Sistema de Standby Manual ==========
        this.isStandby = false;              // Estado de espera manual
        this.requiresManualReset = false;  // Flag para reset obligatorio
        this.lastTriggerReason = null;       // Razón del último bloqueo
        this.standbyHistory = [];            // Historial de entradas a standby
        
        // Restaurar estado persistido o inicializar nuevo
        if (savedState) {
            console.log('🛡️ [Shield] Estado previo encontrado:', savedState);
            this.inversionHistory = savedState.inversionHistory || [];
            this.consecutiveTraps = savedState.consecutiveTraps || 0;
            this.adaptiveThreshold = savedState.adaptiveThreshold || 0.60;
            this.totalChecks = savedState.totalChecks || 0;
            this.totalTrapsDetected = savedState.totalTrapsDetected || 0;
            this.totalInversions = savedState.totalInversions || 0;
            this.successfulInversions = savedState.successfulInversions || 0;
            
            // ========== NUEVO: Restaurar estado de standby ==========
            this.isStandby = savedState.isStandby || false;
            this.requiresManualReset = savedState.requiresManualReset || false;
            this.lastTriggerReason = savedState.lastTriggerReason || null;
            this.standbyHistory = savedState.standbyHistory || [];
            
            // Restaurar patrones aprendidos del seedChangeDetector
            if (savedState.learnedPatterns) {
                this._restoreLearnedPatterns(savedState.learnedPatterns);
            }
            
            if (this.isStandby) {
                console.log('🛡️ [Shield] ⚠️ Sistema estaba en STANDBY - Requiere reset manual');
            }
        } else {
            console.log('🛡️ [Shield] No hay estado previo, iniciando nuevo');
            this.inversionHistory = [];
            this.consecutiveTraps = 0;
            this.adaptiveThreshold = 0.60;
            this.totalChecks = 0;
            this.totalTrapsDetected = 0;
            this.totalInversions = 0;
            this.successfulInversions = 0;
        }
        
        console.log(`🛡️ [Shield] Inicializado - Inversiones históricas: ${this.inversionHistory.length}, Umbral: ${this.adaptiveThreshold.toFixed(3)}, Standby: ${this.isStandby ? 'SÍ' : 'NO'}`);
    }
    
    /**
     * ========== NUEVO MÉTODO: Entrar en Standby ==========
     * Activa el modo de espera manual después de detección crítica
     */
    enterStandby(reason, details = {}) {
        this.isStandby = true;
        this.requiresManualReset = true;
        
        const triggerInfo = {
            reason: reason,
            details: details,
            timestamp: Date.now(),
            consecutiveTrapsAtTrigger: this.consecutiveTraps,
            confidenceAtTrigger: details.confidence || 0,
            thresholdAtTrigger: this.adaptiveThreshold
        };
        
        this.lastTriggerReason = triggerInfo;
        this.standbyHistory.push(triggerInfo);
        
        // Limitar historial
        if (this.standbyHistory.length > 10) {
            this.standbyHistory.shift();
        }
        
        console.log('🛡️ [Shield] 🔒 STANDBY ACTIVADO');
        console.log('   Razón:', reason);
        console.log('   Confianza:', `${(details.confidence * 100).toFixed(1)}%`);
        console.log('   Trampas consecutivas:', this.consecutiveTraps);
        console.log('   Esperando reset manual...');
        
        this._saveState();
        
        return {
            status: 'STANDBY',
            reason: reason,
            canReset: true,
            requiresManualReset: true,
            timestamp: Date.now(),
            details: triggerInfo
        };
    }
    
    /**
     * ========== NUEVO MÉTODO: Reset Manual ==========
     * Permite al usuario reactivar el escudo manualmente
     */
    manualReset(userConfirmation = {}) {
        // Verificar que realmente se necesita reset
        if (!this.requiresManualReset && !this.isStandby) {
            console.log('🛡️ [Shield] ℹ️ No se requiere reset manual - Sistema activo');
            return { 
                success: false, 
                message: 'No hay standby activo',
                alreadyActive: true 
            };
        }
        
        // Validar confirmación del usuario (opcional pero recomendado)
        if (userConfirmation.confirmed !== true) {
            console.log('🛡️ [Shield] ⚠️ Reset requiere confirmación explícita');
            return {
                success: false,
                message: 'Se requiere confirmación explícita del usuario',
                needsConfirmation: true,
                lastReason: this.lastTriggerReason
            };
        }
        
        // Guardar info del standby que estamos cerrando
        const previousStandby = this.lastTriggerReason;
        
        // Reactivar sistema
        this.isStandby = false;
        this.requiresManualReset = false;
        this.consecutiveTraps = 0; // Resetear contador de trampas
        
        // Ajustar umbral temporalmente para ser más conservador después del reset
        const previousThreshold = this.adaptiveThreshold;
        this.adaptiveThreshold = Math.min(0.75, this.adaptiveThreshold + 0.05);
        
        console.log('🛡️ [Shield] ✅ RESET MANUAL EJECUTADO');
        console.log('   Sistema reactivado');
        console.log('   Umbral ajustado:', `${previousThreshold.toFixed(3)} → ${this.adaptiveThreshold.toFixed(3)}`);
        console.log('   Contador de trampas reseteado a 0');
        
        // Guardar estado
        this._saveState();
        
        return {
            success: true,
            message: 'Escudo reactivado manualmente',
            previousReason: previousStandby,
            newThreshold: this.adaptiveThreshold,
            timestamp: Date.now(),
            recoveryMode: true, // Indica que estamos en modo recuperación
            recoveryDuration: 30000 // 30 segundos de precaución aumentada
        };
    }
    
    /**
     * ========== NUEVO MÉTODO: Verificar necesidad de reset ==========
     */
    needsManualReset() {
        return this.requiresManualReset || this.isStandby;
    }
    
    /**
     * ========== NUEVO MÉTODO: Obtener estado de standby ==========
     */
    getStandbyStatus() {
        if (!this.isStandby) {
            return {
                isStandby: false,
                canOperate: true
            };
        }
        
        return {
            isStandby: true,
            canOperate: false,
            requiresManualReset: this.requiresManualReset,
            reason: this.lastTriggerReason?.reason || 'Desconocido',
            details: this.lastTriggerReason?.details || {},
            triggeredAt: this.lastTriggerReason?.timestamp,
            timeInStandby: Date.now() - (this.lastTriggerReason?.timestamp || Date.now()),
            standbyCount: this.standbyHistory.length,
            history: this.standbyHistory.slice(-5) // Últimos 5 standby
        };
    }
    
    /**
     * ========== MÉTODO MODIFICADO: check() con soporte Standby ==========
     */
    check(prediction, context = {}) {
        this.totalChecks++;
        
        // ========== PRIORIDAD 1: Verificar si estamos en Standby ==========
        if (this.isStandby) {
            console.log(`🛡️ [Shield] Check #${this.totalChecks} - 🔒 STANDBY ACTIVO - Operación bloqueada`);
            
            return {
                isAdversarial: true,
                confidence: 1.0,
                votes: { standby: 1 },
                details: {
                    standby: true,
                    reason: this.lastTriggerReason?.reason || 'Esperando reset manual',
                    triggeredAt: this.lastTriggerReason?.timestamp
                },
                recommendation: 'STANDBY',
                finalDirection: null,
                originalDirection: prediction,
                wasInverted: false,
                reason: `🔒 STANDBY: ${this.lastTriggerReason?.reason || 'Esperando reset manual'}`,
                needsManualReset: true,
                canProceed: false,
                standbyStatus: this.getStandbyStatus(),
                timestamp: Date.now()
            };
        }
        
        const sequence = window.sequence || [];
        
        console.log(`🛡️ [Shield] Check #${this.totalChecks} - Predicción: ${prediction}, Historial inversiones: ${this.inversionHistory.length}`);
        
        // Registrar tu intención de acción
        this.detectors.brokerTempo.recordUserAction();
        
        const votes = { anomaly: 0, seedChange: 0, brokerTempo: 0, microstructure: 0 };
        const details = {};
        
        // 1. DETECTOR ANOMALÍAS
        if (sequence.length >= 10) {
            const window = sequence.slice(-10);
            const features = this.detectors.anomaly.extractFeatures(window);
            if (this.detectors.anomaly.isAnomaly(features)) {
                votes.anomaly = 1;
                details.anomaly = { reason: 'Secuencia anómala detectada', features };
            }
        }
        
        // 2. DETECTOR SEMILLA
        const seedCheck = this.detectors.seedChange.detect(sequence);
        if (seedCheck.isManipulated) {
            votes.seedChange = 1;
            details.seedChange = seedCheck.details;
        }
        
        // 3. DETECTOR TEMPO
        const tempoCheck = this.detectors.brokerTempo.check();
        if (tempoCheck.isSuspicious) {
            votes.brokerTempo = 1;
            details.tempoCheck = tempoCheck.details;
        }
        
        // 4. MICROESTRUCTURA
        const spoofCheck = this.detectors.microstructure.detectSpoofing();
        if (spoofCheck.detected) {
            votes.microstructure = 1;
            details.microstructure = spoofCheck.details;
        }
        
        // Calcular confianza
        const activeDetectors = Object.values(votes).filter(v => v === 1).length;
        const totalDetectors = 4;
        const confidence = activeDetectors / totalDetectors;
        
        console.log(`🛡️ [Shield] Votos: A=${votes.anomaly}, S=${votes.seedChange}, T=${votes.brokerTempo}, M=${votes.microstructure} | Confianza: ${(confidence*100).toFixed(1)}%`);
        
        // ========== LÓGICA DE DECISIÓN CON STANDBY ==========
        
        // CRITERIO PARA STANDBY: 2+ trampas consecutivas con alta confianza
        const shouldEnterStandby = (confidence >= this.adaptiveThreshold && this.consecutiveTraps >= 2) ||
                                   (confidence >= 0.80 && this.consecutiveTraps >= 1);
        
        if (shouldEnterStandby) {
            this.totalTrapsDetected++;
            this.consecutiveTraps++;
            
            console.log(`🛡️ [Shield] 🚨 CRITERIO DE STANDBY ALCANZADO`);
            console.log(`   Confianza: ${(confidence*100).toFixed(1)}%`);
            console.log(`   Trampas consecutivas: ${this.consecutiveTraps}`);
            
            // Entrar en standby en lugar de solo bloquear
            return this.enterStandby(
                `Trampa crítica detectada (${(confidence*100).toFixed(0)}% confianza, ${this.consecutiveTraps} consecutivas)`,
                { 
                    confidence: confidence, 
                    votes: votes, 
                    consecutiveTraps: this.consecutiveTraps,
                    context: context 
                }
            );
        }
        
        // Lógica normal de decisión (sin standby)
        let recommendation = 'PROCEED';
        let finalDirection = prediction;
        let reason = 'Sin indicios de trampa';
        let wasInverted = false;
        
        if (confidence >= this.adaptiveThreshold) {
            this.totalTrapsDetected++;
            this.consecutiveTraps++;
            
            const inversionSuccess = this._calculateInversionSuccess();
            console.log(`🛡️ [Shield] ¡TRAMPA DETECTADA! Éxito histórico inversiones: ${(inversionSuccess*100).toFixed(1)}%, Trampas seguidas: ${this.consecutiveTraps}`);
            
            if (inversionSuccess > 0.55 && this.consecutiveTraps < 2) { // Cambiado a < 2 para entrar en standby antes
                recommendation = 'INVERT';
                finalDirection = prediction === 'A' ? 'B' : 'A';
                wasInverted = true;
                this.totalInversions++;
                reason = `🛡️ TRAMPA ${(confidence*100).toFixed(0)}% - INVIRTIENDO`;
                console.log(`🛡️ [Shield] → DECISIÓN: INVERTIR a ${finalDirection}`);
            } else {
                recommendation = 'BLOCK';
                finalDirection = null;
                reason = `🚫 TRAMPA ${(confidence*100).toFixed(0)}% - BLOQUEADO`;
                console.log(`🛡️ [Shield] → DECISIÓN: BLOQUEAR`);
            }
        } else {
            this.consecutiveTraps = Math.max(0, this.consecutiveTraps - 1);
            console.log(`🛡️ [Shield] → DECISIÓN: PROCEDER`);
        }
        
        // Guardar para aprendizaje
        this.lastProjections.push({
            originalPrediction: prediction,
            finalDirection,
            recommendation,
            confidence,
            votes,
            timestamp: Date.now()
        });
        if (this.lastProjections.length > 30) this.lastProjections.shift();
        
        // Guardar estado automáticamente
        this._saveState();
        
        return {
            isAdversarial: confidence >= this.adaptiveThreshold,
            confidence,
            votes,
            details,
            recommendation,
            finalDirection,
            originalDirection: prediction,
            wasInverted,
            reason,
            consecutiveTraps: this.consecutiveTraps,
            adaptiveThreshold: this.adaptiveThreshold,
            stats: this.getStats(),
            isStandby: false,
            canProceed: recommendation !== 'BLOCK',
            timestamp: Date.now()
        };
    }
    
    /**
     * ========== MÉTODO MODIFICADO: _saveState con standby ==========
     */
    _saveState() {
        try {
            const state = {
                inversionHistory: this.inversionHistory,
                consecutiveTraps: this.consecutiveTraps,
                adaptiveThreshold: this.adaptiveThreshold,
                totalChecks: this.totalChecks,
                totalTrapsDetected: this.totalTrapsDetected,
                totalInversions: this.totalInversions,
                successfulInversions: this.successfulInversions,
                learnedPatterns: this._getLearnedPatterns(),
                
                // ========== NUEVO: Guardar estado de standby ==========
                isStandby: this.isStandby,
                requiresManualReset: this.requiresManualReset,
                lastTriggerReason: this.lastTriggerReason,
                standbyHistory: this.standbyHistory,
                
                timestamp: Date.now()
            };
            localStorage.setItem('v27_shield_state', JSON.stringify(state));
            console.log('🛡️ [Shield] Estado guardado:', {
                inversiones: this.inversionHistory.length,
                trampasConsecutivas: this.consecutiveTraps,
                umbral: this.adaptiveThreshold.toFixed(3),
                standby: this.isStandby ? 'SÍ 🔒' : 'NO ✅'
            });
        } catch (e) {
            console.error('🛡️ [Shield] Error guardando estado:', e);
        }
    }
    
    /**
     * ========== MÉTODO MODIFICADO: reset con standby ==========
     */
    reset() {
        console.log('🛡️ [Shield] REINICIO COMPLETO - Borrando todo el historial incluyendo standby');
        localStorage.removeItem('v27_shield_state');
        
        // Resetear todo incluyendo standby
        this.inversionHistory = [];
        this.consecutiveTraps = 0;
        this.adaptiveThreshold = 0.60;
        this.totalChecks = 0;
        this.totalTrapsDetected = 0;
        this.totalInversions = 0;
        this.successfulInversions = 0;
        this.lastProjections = [];
        
        // ========== NUEVO: Resetear standby ==========
        this.isStandby = false;
        this.requiresManualReset = false;
        this.lastTriggerReason = null;
        this.standbyHistory = [];
        
        // Resetear detectores
        this.detectors.seedChange = new SeedChangeDetector();
        this.detectors.brokerTempo.reset();
        this.detectors.microstructure.reset();
        
        console.log('🛡️ [Shield] ✅ Sistema completamente reseteado y listo para operar');
    }
    
    // ========== MÉTODOS EXISTENTES (sin cambios) ==========
    
    learnResult(originalPrediction, actualResult, wasInverted) {
        console.log(`🛡️ [Shield] Aprendizaje: Pred=${originalPrediction}, Real=${actualResult}, Invertido=${wasInverted}`);
        
        // No aprender si estamos en standby (esperando reset manual)
        if (this.isStandby) {
            console.log('🛡️ [Shield] ℹ️ En standby - Aprendizaje pospuesto hasta reactivación');
            return;
        }
        
        // Enseñar a detector de semilla
        const wasTrap = originalPrediction !== actualResult;
        this.detectors.seedChange.learn(window.sequence || [], wasTrap);
        
        // Registrar en microestructura
        this.detectors.microstructure.recordResult(actualResult, wasInverted);
        
        // Actualizar histórico de inversiones
        if (wasInverted) {
            const success = originalPrediction !== actualResult;
            this.inversionHistory.push(success ? 1 : 0);
            if (this.inversionHistory.length > 20) this.inversionHistory.shift();
            
            if (success) this.successfulInversions++;
            
            console.log(`🛡️ [Shield] Inversión ${success ? 'EXITOSA' : 'FALLIDA'} - Historial: ${this._calculateInversionSuccess().toFixed(2)}`);
            
            this._updateAdaptiveThreshold();
        }
        
        // Enseñar a anomaly detector
        if (window.sequence && window.sequence.length >= 10) {
            this.detectors.anomaly.label(window.sequence.slice(-10), wasTrap ? 'LOSS' : 'WIN');
        }
        
        this._saveState();
    }
    
    _calculateInversionSuccess() {
        if (this.inversionHistory.length < 5) return 0.5;
        const recent = this.inversionHistory.slice(-10);
        return recent.reduce((a, b) => a + b, 0) / recent.length;
    }
    
    _updateAdaptiveThreshold() {
        const success = this._calculateInversionSuccess();
        const oldThreshold = this.adaptiveThreshold;
        this.adaptiveThreshold = 0.50 + (0.20 * (1 - success));
        this.adaptiveThreshold = Math.max(0.45, Math.min(0.75, this.adaptiveThreshold));
        console.log(`🛡️ [Shield] Umbral adaptativo: ${oldThreshold.toFixed(3)} → ${this.adaptiveThreshold.toFixed(3)}`);
    }
    
    recordTrade(direction, stake) {
        // No registrar trades si estamos en standby
        if (this.isStandby) {
            console.log('🛡️ [Shield] ⚠️ Intento de trade en STANDBY - Ignorando');
            return;
        }
        this.detectors.microstructure.recordYourTrade(direction, stake);
        this.detectors.brokerTempo.recordResult();
    }
    
    getStats() {
        const micro = this.detectors.microstructure.calculateOBI();
        return {
            totalChecks: this.totalChecks,
            totalTrapsDetected: this.totalTrapsDetected,
            totalInversions: this.totalInversions,
            successfulInversions: this.successfulInversions,
            inversionSuccessRate: this.inversionHistory.length > 0 ? 
                (this.inversionHistory.reduce((a,b)=>a+b,0) / this.inversionHistory.length) : 0,
            currentThreshold: this.adaptiveThreshold,
            consecutiveTraps: this.consecutiveTraps,
            inversionHistoryLength: this.inversionHistory.length,
            yourBias: micro.signal,
            yourImbalance: micro.obi,
            tempoStatus: this.detectors.brokerTempo.check().isSuspicious ? 'SOSPECHOSO' : 'NORMAL',
            
            // ========== NUEVO: Estadísticas de standby ==========
            isStandby: this.isStandby,
            requiresManualReset: this.requiresManualReset,
            standbyCount: this.standbyHistory.length,
            lastStandbyReason: this.lastTriggerReason?.reason || null,
            
            lastSave: new Date(localStorage.getItem('v27_shield_state') ? 
                JSON.parse(localStorage.getItem('v27_shield_state')).timestamp : Date.now()).toLocaleTimeString()
        };
    }
    
    _loadState() {
        try {
            const saved = localStorage.getItem('v27_shield_state');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Verificar que no sea muy viejo (más de 7 días)
                const age = Date.now() - (parsed.timestamp || 0);
                if (age < 7 * 24 * 60 * 60 * 1000) {
                    return parsed;
                } else {
                    console.log('🛡️ [Shield] Estado muy antiguo, ignorando');
                }
            }
        } catch (e) {
            console.error('🛡️ [Shield] Error cargando estado:', e);
        }
        return null;
    }
    
    _getLearnedPatterns() {
        const patterns = [];
        if (this.detectors && this.detectors.seedChange && this.detectors.seedChange.patterns) {
            for (const [hash, data] of this.detectors.seedChange.patterns.entries()) {
                patterns.push([hash, data]);
            }
        }
        return patterns;
    }
    
    _restoreLearnedPatterns(patterns) {
        if (this.detectors && this.detectors.seedChange && this.detectors.seedChange.patterns) {
            patterns.forEach(([hash, data]) => {
                this.detectors.seedChange.patterns.set(hash, data);
            });
            console.log(`🛡️ [Shield] ${patterns.length} patrones restaurados`);
        }
    }

    
    /**
     * Método principal: Consultar escudo ANTES de operar
     */
    check(prediction, context = {}) {
        this.totalChecks++;
        const sequence = window.sequence || [];
        
        console.log(`🛡️ [Shield] Check #${this.totalChecks} - Predicción: ${prediction}, Historial inversiones: ${this.inversionHistory.length}`);
        
        // Registrar tu intención de acción
        this.detectors.brokerTempo.recordUserAction();
        
        const votes = { anomaly: 0, seedChange: 0, brokerTempo: 0, microstructure: 0 };
        const details = {};
        
        // 1. DETECTOR ANOMALÍAS
        if (sequence.length >= 10) {
            const window = sequence.slice(-10);
            const features = this.detectors.anomaly.extractFeatures(window);
            if (this.detectors.anomaly.isAnomaly(features)) {
                votes.anomaly = 1;
                details.anomaly = { reason: 'Secuencia anómala detectada', features };
            }
        }
        
        // 2. DETECTOR SEMILLA
        const seedCheck = this.detectors.seedChange.detect(sequence);
        if (seedCheck.isManipulated) {
            votes.seedChange = 1;
            details.seedChange = seedCheck.details;
        }
        
        // 3. DETECTOR TEMPO
        const tempoCheck = this.detectors.brokerTempo.check();
        if (tempoCheck.isSuspicious) {
            votes.brokerTempo = 1;
            details.brokerTempo = tempoCheck.details;
        }
        
        // 4. MICROESTRUCTURA
        const spoofCheck = this.detectors.microstructure.detectSpoofing();
        if (spoofCheck.detected) {
            votes.microstructure = 1;
            details.microstructure = spoofCheck.details;
        }
        
        // Calcular confianza
        const activeDetectors = Object.values(votes).filter(v => v === 1).length;
        const totalDetectors = 4;
        const confidence = activeDetectors / totalDetectors;
        
        console.log(`🛡️ [Shield] Votos: A=${votes.anomaly}, S=${votes.seedChange}, T=${votes.brokerTempo}, M=${votes.microstructure} | Confianza: ${(confidence*100).toFixed(1)}%`);
        
        // LÓGICA DE DECISIÓN
        let recommendation = 'PROCEED';
        let finalDirection = prediction;
        let reason = 'Sin indicios de trampa';
        let wasInverted = false;
        
        if (confidence >= this.adaptiveThreshold) {
            this.totalTrapsDetected++;
            this.consecutiveTraps++;
            
            const inversionSuccess = this._calculateInversionSuccess();
            console.log(`🛡️ [Shield] ¡TRAMPA DETECTADA! Éxito histórico inversiones: ${(inversionSuccess*100).toFixed(1)}%, Trampas seguidas: ${this.consecutiveTraps}`);
            
            if (inversionSuccess > 0.55 && this.consecutiveTraps < 3) {
                recommendation = 'INVERT';
                finalDirection = prediction === 'A' ? 'B' : 'A';
                wasInverted = true;
                this.totalInversions++;
                reason = `🛡️ TRAMPA ${(confidence*100).toFixed(0)}% - INVIRTIENDO`;
                console.log(`🛡️ [Shield] → DECISIÓN: INVERTIR a ${finalDirection}`);
            } else {
                recommendation = 'BLOCK';
                finalDirection = null;
                reason = `🚫 TRAMPA ${(confidence*100).toFixed(0)}% - BLOQUEADO`;
                console.log(`🛡️ [Shield] → DECISIÓN: BLOQUEAR`);
            }
        } else {
            this.consecutiveTraps = Math.max(0, this.consecutiveTraps - 1);
            console.log(`🛡️ [Shield] → DECISIÓN: PROCEDER`);
        }
        
        // Guardar para aprendizaje
        this.lastProjections.push({
            originalPrediction: prediction,
            finalDirection,
            recommendation,
            confidence,
            votes,
            timestamp: Date.now()
        });
        if (this.lastProjections.length > 30) this.lastProjections.shift();
        
        // Guardar estado automáticamente
        this._saveState();
        
        return {
            isAdversarial: confidence >= this.adaptiveThreshold,
            confidence,
            votes,
            details,
            recommendation,
            finalDirection,
            originalDirection: prediction,
            wasInverted,
            reason,
            consecutiveTraps: this.consecutiveTraps,
            adaptiveThreshold: this.adaptiveThreshold,
            stats: this.getStats(),
            timestamp: Date.now()
        };
    }
    
    /**
     * Método para llamar DESPUÉS de saber el resultado (aprendizaje)
     */
    learnResult(originalPrediction, actualResult, wasInverted) {
        console.log(`🛡️ [Shield] Aprendizaje: Pred=${originalPrediction}, Real=${actualResult}, Invertido=${wasInverted}`);
        
        // Enseñar a detector de semilla
        const wasTrap = originalPrediction !== actualResult;
        this.detectors.seedChange.learn(window.sequence || [], wasTrap);
        
        // Registrar en microestructura
        this.detectors.microstructure.recordResult(actualResult, wasInverted);
        
        // Actualizar histórico de inversiones
        if (wasInverted) {
            const success = originalPrediction !== actualResult;
            this.inversionHistory.push(success ? 1 : 0);
            if (this.inversionHistory.length > 20) this.inversionHistory.shift();
            
            if (success) this.successfulInversions++;
            
            console.log(`🛡️ [Shield] Inversión ${success ? 'EXITOSA' : 'FALLIDA'} - Historial: ${this._calculateInversionSuccess().toFixed(2)}`);
            
            this._updateAdaptiveThreshold();
        }
        
        // Enseñar a anomaly detector
        if (window.sequence && window.sequence.length >= 10) {
            this.detectors.anomaly.label(window.sequence.slice(-10), wasTrap ? 'LOSS' : 'WIN');
        }
        
        this._saveState();
    }
    
    _calculateInversionSuccess() {
        if (this.inversionHistory.length < 5) return 0.5;
        const recent = this.inversionHistory.slice(-10);
        return recent.reduce((a, b) => a + b, 0) / recent.length;
    }
    
    _updateAdaptiveThreshold() {
        const success = this._calculateInversionSuccess();
        const oldThreshold = this.adaptiveThreshold;
        this.adaptiveThreshold = 0.50 + (0.20 * (1 - success));
        this.adaptiveThreshold = Math.max(0.45, Math.min(0.75, this.adaptiveThreshold));
        console.log(`🛡️ [Shield] Umbral adaptativo: ${oldThreshold.toFixed(3)} → ${this.adaptiveThreshold.toFixed(3)}`);
    }
    
    recordTrade(direction, stake) {
        this.detectors.microstructure.recordYourTrade(direction, stake);
        this.detectors.brokerTempo.recordResult();
    }
    
    getStats() {
        const micro = this.detectors.microstructure.calculateOBI();
        return {
            totalChecks: this.totalChecks,
            totalTrapsDetected: this.totalTrapsDetected,
            totalInversions: this.totalInversions,
            successfulInversions: this.successfulInversions,
            inversionSuccessRate: this.inversionHistory.length > 0 ? 
                (this.inversionHistory.reduce((a,b)=>a+b,0) / this.inversionHistory.length) : 0,
            currentThreshold: this.adaptiveThreshold,
            consecutiveTraps: this.consecutiveTraps,
            inversionHistoryLength: this.inversionHistory.length,
            yourBias: micro.signal,
            yourImbalance: micro.obi,
            tempoStatus: this.detectors.brokerTempo.check().isSuspicious ? 'SOSPECHOSO' : 'NORMAL',
            lastSave: new Date(localStorage.getItem('v27_shield_state') ? 
                JSON.parse(localStorage.getItem('v27_shield_state')).timestamp : Date.now()).toLocaleTimeString()
        };
    }
    
    reset() {
        console.log('🛡️ [Shield] REINICIO COMPLETO - Borrando todo el historial');
        localStorage.removeItem('v27_shield_state');
        this.inversionHistory = [];
        this.consecutiveTraps = 0;
        this.adaptiveThreshold = 0.60;
        this.totalChecks = 0;
        this.totalTrapsDetected = 0;
        this.totalInversions = 0;
        this.successfulInversions = 0;
        this.lastProjections = [];
        this.detectors.seedChange = new SeedChangeDetector();
        this.detectors.brokerTempo.reset();
        this.detectors.microstructure.reset();
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RISK OVERLAY (existente, sin cambios)
// ═══════════════════════════════════════════════════════════════════════════════

class RiskOverlay {
    constructor() {
        this.ledger = new ImmutableLedger();
        this.metrics = new MetricsExporter();
        this.circuitBreakers = { 
            consecutiveLosses: 0, 
            dailyLoss: 0, 
            lastReset: Date.now(),
            tradeCount: 0
        };
        this.isHalted = false;
        this.firstTrade = true;
        this.initialized = false;
    }
    
    evaluate(position, marketState, portfolio) {
        if (this.firstTrade || !this.initialized) {
            this.initialized = true;
            return { 
                approved: true, 
                checks: this.getDefaultChecks(), 
                halt: false, 
                timestamp: Date.now(),
                reason: 'INITIALIZING'
            };
        }
        
        if (!portfolio || typeof portfolio.equity !== 'number' || isNaN(portfolio.equity)) {
            return { 
                approved: true, 
                checks: this.getDefaultChecks(), 
                halt: false, 
                timestamp: Date.now(),
                reason: 'NO_DATA'
            };
        }
        
        const checks = {
            drawdown: this._checkDrawdown(portfolio),
            volatility: this._checkVolatility(marketState),
            latency: { passed: true, value: 0, limit: 500 },
            exposure: this._checkExposure(position, portfolio),
            circuitBreaker: this._checkCircuitBreakers(),
            minTrades: { passed: this.circuitBreakers.tradeCount >= 3, value: this.circuitBreakers.tradeCount, limit: 3 }
        };
        
        const isSafe = Object.values(checks).every(c => c.passed);
        
        if (!isSafe && !this.isHalted) {
            this._triggerHalt(checks);
        }
        
        this.ledger.append({ position, checks, isSafe, timestamp: Date.now() });
        
        return { approved: isSafe, checks, halt: this.isHalted, timestamp: Date.now() };
    }
    
    getDefaultChecks() {
        return {
            drawdown: { passed: true, value: 0, limit: 0.15 },
            volatility: { passed: true, value: 0, limit: 40 },
            latency: { passed: true, value: 0, limit: 500 },
            exposure: { passed: true, value: 0, limit: 1.0 },
            circuitBreaker: { passed: true, consecutiveLosses: 0, dailyLoss: 0 },
            minTrades: { passed: true, value: 0, limit: 3 }
        };
    }
    
    _checkDrawdown(portfolio) {
        if (!portfolio || !portfolio.peak || portfolio.peak === 0 || !portfolio.equity || isNaN(portfolio.equity)) {
            return { passed: true, value: 0, limit: V27_CONFIG.RISK.MAX_DRAWDOWN };
        }
        
        const peak = portfolio.peak || portfolio.equity || 1000;
        const current = portfolio.equity || 1000;
        const drawdown = peak > 0 ? (peak - current) / peak : 0;
        
        return {
            passed: drawdown < V27_CONFIG.RISK.MAX_DRAWDOWN,
            value: Math.max(0, drawdown),
            limit: V27_CONFIG.RISK.MAX_DRAWDOWN
        };
    }
    
    _checkVolatility(marketState) {
        if (!marketState || typeof marketState.volatility !== 'number' || isNaN(marketState.volatility) || marketState.volatility < 0) {
            return { passed: true, value: 0, limit: V27_CONFIG.RISK.CRISIS_VOL_THRESHOLD, isCrisis: false };
        }
        
        const vol = marketState.volatility;
        
        return {
            passed: vol < V27_CONFIG.RISK.CRISIS_VOL_THRESHOLD,
            value: vol,
            limit: V27_CONFIG.RISK.CRISIS_VOL_THRESHOLD,
            isCrisis: vol >= V27_CONFIG.RISK.CRISIS_VOL_THRESHOLD
        };
    }
    
    _checkExposure(position, portfolio) {
        if (!portfolio || !portfolio.positions || !portfolio.equity || portfolio.equity === 0 || isNaN(portfolio.equity)) {
            return { passed: true, value: 0, limit: V27_CONFIG.RISK.EXPOSURE_MAX };
        }
        
        const totalExposure = portfolio.positions.reduce((sum, p) => sum + Math.abs(p.size || 0), 0);
        const exposureRatio = totalExposure / portfolio.equity;
        
        return {
            passed: exposureRatio < V27_CONFIG.RISK.EXPOSURE_MAX,
            value: exposureRatio,
            limit: V27_CONFIG.RISK.EXPOSURE_MAX
        };
    }
    
    _checkCircuitBreakers() {
        const now = Date.now();
        
        if (now - this.circuitBreakers.lastReset > 86400000) {
            this.circuitBreakers.dailyLoss = 0;
            this.circuitBreakers.consecutiveLosses = 0;
            this.circuitBreakers.lastReset = now;
        }
        
        if (this.circuitBreakers.tradeCount < 3) {
            return {
                passed: true,
                consecutiveLosses: this.circuitBreakers.consecutiveLosses,
                dailyLoss: this.circuitBreakers.dailyLoss,
                reason: 'INSUFFICIENT_TRADES'
            };
        }
        
        const passed = this.circuitBreakers.consecutiveLosses < V27_CONFIG.RISK.CIRCUIT_BREAKER.CONSECUTIVE_LOSSES &&
                      this.circuitBreakers.dailyLoss < V27_CONFIG.RISK.CIRCUIT_BREAKER.DAILY_LOSS_LIMIT;
        
        return {
            passed: passed,
            consecutiveLosses: this.circuitBreakers.consecutiveLosses,
            dailyLoss: this.circuitBreakers.dailyLoss
        };
    }
    
    _triggerHalt(checks) {
        this.isHalted = true;
        console.error('🛑 RISK HALT TRIGGERED:', checks);
        
        setTimeout(() => {
            this.isHalted = false;
            console.log('✅ Risk halt auto-reset');
        }, 5000);
    }
    
    recordOutcome(profit) {
        this.circuitBreakers.tradeCount++;
        this.firstTrade = false;
        
        if (profit < 0) {
            this.circuitBreakers.consecutiveLosses++;
            this.circuitBreakers.dailyLoss += Math.abs(profit);
        } else {
            this.circuitBreakers.consecutiveLosses = 0;
        }
    }
    
    reset() {
        this.circuitBreakers = { 
            consecutiveLosses: 0, 
            dailyLoss: 0, 
            lastReset: Date.now(),
            tradeCount: 0
        };
        this.isHalted = false;
        this.firstTrade = true;
        this.initialized = false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BAYESIAN KELLY (existente)
// ═══════════════════════════════════════════════════════════════════════════════

class BayesianKellyCriterion {
    constructor() {
        this.edgeHistory = [];
        this.payout = V27_CONFIG.TRADING.PAYOUT_DEFAULT;
    }
    
    calculate(edge, variance, confidence = 0.5) {
        const q = 1 - edge;
        const b = this.payout;
        const kellyFull = (edge * b - q) / b;
        const variancePenalty = 1 / (1 + variance * 10);
        const kellyFractional = kellyFull * V27_CONFIG.RISK.KELLY_FRACTION * variancePenalty * confidence;
        
        return {
            full: kellyFull,
            fractional: kellyFractional,
            recommended: Math.max(0, Math.min(kellyFractional, 1.0)),
            variancePenalty,
            confidenceWeight: confidence
        };
    }
    
    updateEdge(outcome, prediction) {
        const wasCorrect = outcome === prediction;
        this.edgeHistory.push(wasCorrect ? 1 : 0);
        if (this.edgeHistory.length > 100) this.edgeHistory.shift();
    }
    
    getCurrentEdge() {
        if (this.edgeHistory.length < 20) return 0.5;
        return this.edgeHistory.reduce((a, b) => a + b, 0) / this.edgeHistory.length;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

window.SeedChangeDetector = SeedChangeDetector;
window.BrokerTempoDetector = BrokerTempoDetector;
window.MicrostructureAnalyzer = MicrostructureAnalyzer;
window.ContextualLabelingEngine = ContextualLabelingEngine;
window.AdversarialShield = AdversarialShield;
window.RiskOverlay = RiskOverlay;
window.BayesianKellyCriterion = BayesianKellyCriterion;

console.log('✅ Parte 4/5 cargada: Escudo Anti-Trampas MANUAL (funciona con TU INPUT)');
/**
 * MARKET BRIDGE QUANTUM MACRO V27 UNIFIED - PARTE 5/5
 * Integración Final, PPO Agent y UI Manager Sincronizado
 */

class PPOAgent {
    constructor(config = V27_CONFIG.HEDGE.PPO) {
        this.config = config;
        this.actor = null;
        this.critic = null;
        this.memory = [];
        this.gamma = config.GAMMA;
        this.lambda = config.LAMBDA;
        this.clipEpsilon = config.CLIP_EPSILON;
        this.epochs = 10;
        this.batchSize = 64;
        this.stateDim = 10;
        this.actionDim = 3;
    }
    
    async build() {
        if (!window.tf) return;
        
        const actorInput = tf.input({shape: [this.stateDim]});
        const actorDense1 = tf.layers.dense({units: 64, activation: 'relu'}).apply(actorInput);
        const actorDense2 = tf.layers.dense({units: 64, activation: 'relu'}).apply(actorDense1);
        const actorOutput = tf.layers.dense({units: this.actionDim, activation: 'softmax'}).apply(actorDense2);
        
        this.actor = tf.model({inputs: actorInput, outputs: actorOutput});
        this.actor.compile({optimizer: tf.train.adam(this.config.LEARNING_RATE), loss: 'categoricalCrossentropy'});
        
        const criticInput = tf.input({shape: [this.stateDim]});
        const criticDense1 = tf.layers.dense({units: 64, activation: 'relu'}).apply(criticInput);
        const criticDense2 = tf.layers.dense({units: 64, activation: 'relu'}).apply(criticDense1);
        const criticOutput = tf.layers.dense({units: 1, activation: 'linear'}).apply(criticDense2);
        
        this.critic = tf.model({inputs: criticInput, outputs: criticOutput});
        this.critic.compile({optimizer: tf.train.adam(this.config.LEARNING_RATE * 3), loss: 'meanSquaredError'});
    }
    
    chooseAction(state, deterministic = false) {
        if (!this.actor) return 2;
        
        const stateTensor = tf.tensor2d([state]);
        const probs = this.actor.predict(stateTensor).dataSync();
        stateTensor.dispose();
        
        if (deterministic) return probs.indexOf(Math.max(...probs));
        
        const random = Math.random();
        let cumsum = 0;
        for (let i = 0; i < probs.length; i++) {
            cumsum += probs[i];
            if (random < cumsum) return i;
        }
        return probs.length - 1;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKET BRIDGE V27 - INTEGRACIÓN FINAL CON UI SINCRONIZADA
// ═══════════════════════════════════════════════════════════════════════════════

const MarketBridgeV27 = {
    equity: 1000,
    currentStake: 10,
    isLocked: false,
    isPaused: false,
    predictions: {},
    priceHistory: [],
    currentStreak: { val: null, count: 0 },
    sequence: [],
    traps: [],
    stats: {},
    
    // Componentes V27
    technicalIndicators: null,
    frozenBackbone: null,
    bayesianEnsemble: null,
    regimeDetector: null,
    adversarialShield: null,
    riskOverlay: null,
    kellyCriterion: null,
    ppoAgent: null,
    metrics: null,
    ledger: null,
    
    // Estado de señales
    signals: { technical: null, ml: null, composite: 'NEUTRAL', confidence: 0, timestamp: 0 },
    
    // Contadores
    totalTrades: 0,
    wins: 0,
    losses: 0,
    trapsAvoided: 0,
    trapInversionsTotal: 0,
    trapInversionsSuccess: 0,
    dynamicTrapThreshold: 0.65,
    isInTrapRecovery: false,
    
    // Flags
    isManualReversal: false,
    martingaleLevel: 0,
    
    async init() {
        console.log('🚀 Inicializando MarketBridge V27...');
        
        // Inicializar arrays globales para compatibilidad
        window.sequence = this.sequence;
        window.traps = this.traps;
        
        // Inicializar stats
        for (let i = 3; i <= 20; i++) {
            this.stats[i] = { hits: 0, total: 0, timeline: [] };
        }
        
        // Componentes base
        this.technicalIndicators = new TechnicalIndicators();
        this.frozenBackbone = new FrozenBackbone();
        this.bayesianEnsemble = new BayesianEnsemble();
        this.regimeDetector = new RegimeDetector();
        this.adversarialShield = new AdversarialShield();
        this.riskOverlay = new RiskOverlay();
        this.kellyCriterion = new BayesianKellyCriterion();
        this.ppoAgent = new PPOAgent();
        this.metrics = new MetricsExporter();
        this.ledger = new ImmutableLedger();
        
        
        // Construir modelos TF
        if (window.tf) {
            try {
                await this.frozenBackbone.loadOrBuild([V27_CONFIG.ML.LSTM.WINDOW_SIZE, 1]);
                await this.ppoAgent.build();
                this.bayesianEnsemble.addModel('frozen', {predict: (input) => this.frozenBackbone.predict(input)}, 0.4);
                this.bayesianEnsemble.addModel('technical', { predict: () => [0.5] }, 0.3);
                this.bayesianEnsemble.addModel('trap', { predict: () => [0.5] }, 0.3);
            } catch (e) {
                console.warn('⚠️ TensorFlow no disponible, usando modo simulado');
            }
        }
        
        // Setup eventos
        this.setupInput();
        
        // Iniciar loops
        this.startUpdateLoops();
        
        // UI inicial
        this.updateAllUI();
        
        console.log('✅ MarketBridge V27 inicializado');
        this.addLog('Quantum Macro V27 iniciado', '#00d4ff', 'system');
    },
    
    setupInput() {
        // Click en fondo
        document.addEventListener('mousedown', (e) => {
            if (e.target.closest('button') || e.target.closest('.v27-panel')) return;
            
            let side = null;
            if (e.button === 0) {
                side = 'A';
                console.log('[MOUSE] Click izquierdo → BUY');
            } else if (e.button === 2) {
                side = 'B';
                console.log('[MOUSE] Click derecho → SELL');
            }
            
            if (side) {
                e.preventDefault();
                this.injectManual(side);
            }
        });
        
        // Botones principales
        const buyBtn = document.getElementById('v27-buy');
        const sellBtn = document.getElementById('v27-sell');
        
        if (buyBtn) {
            buyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.executeTrade('BUY');
            });
        }
        
        if (sellBtn) {
            sellBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.executeTrade('SELL');
            });
        }
        
        document.addEventListener('contextmenu', e => {
            if (e.target.closest('#sequence-live-panel') || e.target.closest('#live-sequence')) {
                e.preventDefault();
            }
        });
    },
    
  executeTrade(direction) {
    if (this.isLocked || this.isPaused) {
        this.addLog('🔒 Sistema bloqueado - Trade rechazado', '#ff4d82', 'risk');
        return;
    }
    
    const dir = direction === 'BUY' ? 'A' : 'B';
    
    // 🛡️ CONSULTAR ESCUDO ANTI-TRAMPAS ANTES DE OPERAR
    const shieldCheck = this.adversarialShield.check(dir, {
        stake: this.currentStake,
        features: this.signals.technical ? {
            momentum: this.signals.technical.momentumScore,
            rsi: this.signals.technical.rsi?.value,
            volatility: this.calculateVolatility() / 100
        } : null
    });
    
    // Log del análisis del escudo
    if (shieldCheck.isAdversarial) {
        this.addLog(`🛡️ ${shieldCheck.reason}`, '#ff9f43', 'trap');
        console.log('🛡️ Escudo detectó:', shieldCheck.details);
    }
    
    // Determinar dirección final según decisión del escudo
    let finalDir = dir;
    let wasInverted = false;
    
    if (shieldCheck.recommendation === 'BLOCK') {
        this.addLog('🚫 Operación BLOQUEADA por escudo anti-trampa', '#ff4d82', 'risk');
        this.updateShieldUI(shieldCheck, true);
        return; // NO OPERAR
    } else if (shieldCheck.recommendation === 'INVERT') {
        finalDir = dir === 'A' ? 'B' : 'A';
        wasInverted = true;
        this.trapInversionsTotal++;
        this.addLog(`🔄 INVERSIÓN: ${direction} → ${finalDir === 'A' ? 'BUY' : 'SELL'}`, '#ff00ff', 'system');
    }
    
    // Registrar trade en escudo para análisis de microestructura
    this.adversarialShield.recordTrade(finalDir, this.currentStake);
    
    // Guardar datos para procesar resultado después
    this.pendingTrade = {
        originalDirection: dir,
        finalDirection: finalDir,
        wasInverted: wasInverted,
        stake: this.currentStake,
        shieldCheck: shieldCheck
    };
    
    // Ledger
    this.ledger.append({
        type: 'TRADE_MANUAL',
        direction: finalDir,
        originalDirection: dir,
        wasInverted: wasInverted,
        stake: this.currentStake,
        shieldConfidence: shieldCheck.confidence,
        timestamp: Date.now()
    });
    
    this.addLog(`Trade ${wasInverted ? '[INV] ' : ''}${finalDir === 'A' ? 'BUY' : 'SELL'} $${this.currentStake}`, '#00d4ff', 'trade');
    
    // Actualizar UI del escudo
    this.updateShieldUI(shieldCheck, false);
    
    // Procesar resultado (llama a tu lógica existente)
    this.processTradeResult(finalDir);
},

// MÉTODO AUXILIAR: Actualizar UI del panel de trampas
updateShieldUI(shieldCheck, wasBlocked) {
    const shieldState = document.getElementById('shield-state');
    const shieldProb = document.getElementById('shield-prob');
    const shieldIcon = document.getElementById('shield-icon');
    const trapCount = document.getElementById('trap-count');
    const trapAvoided = document.getElementById('trap-avoided');
    const trapThreshold = document.getElementById('trap-threshold');
    
    if (shieldState) {
        if (wasBlocked) {
            shieldState.textContent = '🔒 BLOQUEADO';
            shieldState.className = 'shield-state triggered';
        } else if (shieldCheck.wasInverted) {
            shieldState.textContent = '🔄 INVIRTIENDO';
            shieldState.className = 'shield-state triggered';
        } else if (shieldCheck.isAdversarial) {
            shieldState.textContent = '⚠️ TRAMPA DETECTADA';
            shieldState.className = 'shield-state triggered';
        } else {
            shieldState.textContent = '🛡️ ESCUDO ACTIVO';
            shieldState.className = 'shield-state active';
        }
    }
    
    if (shieldProb) {
        shieldProb.textContent = `Prob. Trampa: ${(shieldCheck.confidence * 100).toFixed(1)}%`;
    }
    
    if (shieldIcon) {
        shieldIcon.textContent = wasBlocked ? '🔒' : 
                                  shieldCheck.wasInverted ? '🔄' : 
                                  shieldCheck.isAdversarial ? '⚠️' : '🛡️';
    }
    
    if (trapCount && this.adversarialShield) {
        const stats = this.adversarialShield.getStats();
        trapCount.textContent = stats.trapsDetected;
    }
    
    if (trapAvoided) {
        trapAvoided.textContent = this.trapInversionsSuccess;
    }
    
    if (trapThreshold && shieldCheck.adaptiveThreshold) {
        trapThreshold.textContent = shieldCheck.adaptiveThreshold.toFixed(2);
    }
    
    const trapLastSeq = document.getElementById('trap-last-seq');
    if (trapLastSeq && shieldCheck.isAdversarial) {
        const recent = window.sequence ? window.sequence.slice(-5).map(s => s.val).join('') : '---';
        trapLastSeq.textContent = recent;
    }
},

// MÉTODO AUXILIAR: Obtener estadísticas del escudo
getShieldStatus() {
    if (!this.adversarialShield) return null;
    return this.adversarialShield.getStats();
},

injectManual(val) {
    const direction = val === 'A' ? 'BUY' : 'SELL';
    this.executeTrade(direction);
},

manualShieldReset() {
    if (!this.adversarialShield) {
        this.addLog('⚠️ No hay escudo inicializado', '#ffb400', 'risk');
        return { success: false, message: 'No hay escudo' };
    }
    
    if (!this.adversarialShield.needsManualReset()) {
        this.addLog('ℹ️ El escudo ya está activo - No se requiere reset', '#00d4ff', 'system');
        return { success: false, message: 'No hay standby activo', alreadyActive: true };
    }
    
    const result = this.adversarialShield.manualReset({ confirmed: true });
    
    if (result.success) {
        this.addLog('🛡️ Escudo reactivado MANUALMENTE - Sistema operativo', '#00ffaa', 'system');
        this.addLog(`📊 Umbral ajustado a: ${(result.newThreshold * 100).toFixed(1)}%`, '#00d4ff', 'system');
        
        this.isInTrapRecovery = true;
        this.addLog('⏱️ Modo recuperación activado (30s)', '#ffb400', 'system');
        
        setTimeout(() => {
            this.isInTrapRecovery = false;
            this.addLog('✅ Modo recuperación finalizado - Operación normal', '#00d4ff', 'system');
        }, 30000);
        
        const standbyPanel = document.getElementById('standby-panel');
        if (standbyPanel) standbyPanel.style.display = 'none';
        
    } else {
        this.addLog(`⚠️ No se pudo reactivar: ${result.message}`, '#ffb400', 'risk');
        if (result.needsConfirmation) {
            this.addLog('🔒 Se requiere confirmación explícita para reactivar', '#ff4d82', 'risk');
        }
    }
    
    this.updateAllUI();
    return result;
},

getStandbyStatus() {
    return this.adversarialShield ? this.adversarialShield.getStandbyStatus() : null;
},

processTradeResult(prediction) {
    // 1. MOTOR DE INTERPRETACIÓN TÉCNICA (IA ANALISTA)
    const tech = this.signals.technical;
    let reasons = [];
    let probabilityA = 50; 

    if (tech) {
        probabilityA += (tech.momentumScore / 2);
        
        if (tech.rsi && tech.rsi.value < 35) {
            probabilityA += 15;
            if (prediction === 'A') reasons.push("Sobreventa detectada");
        } else if (tech.rsi && tech.rsi.value > 65) {
            probabilityA -= 15;
            if (prediction === 'B') reasons.push("Sobrecompra detectada");
        }
        
        if (tech.macd && tech.macd.trend === 'BULLISH') {
            probabilityA += 10;
        } else if (tech.macd && tech.macd.trend === 'BEARISH') {
            probabilityA -= 10;
        }
    }

    // 2. GENERAR RESULTADO
    probabilityA = Math.max(20, Math.min(80, probabilityA));
    const actual = (Math.random() * 100) < probabilityA ? 'A' : 'B';
    const isWin = prediction === actual;

    // 🛡️ ENSEÑAR AL ESCUDO EL RESULTADO (APRENDIZAJE)
    if (this.adversarialShield && this.pendingTrade) {
        this.adversarialShield.learnResult(
            this.pendingTrade.originalDirection,
            actual,
            this.pendingTrade.wasInverted
        );
        
        // Si invertimos y ganamos, contar como trampa evitada exitosamente
        if (this.pendingTrade.wasInverted && isWin) {
            this.trapInversionsSuccess++;
            this.trapsAvoided++;
        }
        
        // Log de aprendizaje del escudo
        const stats = this.adversarialShield.getStats();
        if (stats.inversionSuccess > 0) {
            console.log(`🛡️ Escudo aprendizaje: ${(stats.inversionSuccess * 100).toFixed(0)}% éxito en inversiones`);
        }
    }

    // 3. FEEDBACK
    let logMsg = isWin ? "✅ " : "❌ ";
    let logCol = isWin ? '#00ffaa' : '#ff4d82';
    let detail = reasons.length > 0 ? reasons[0] : (isWin ? "Confluencia técnica" : "Discordancia");

    if (window.UIManager) {
        UIManager.addLog(`${logMsg}${detail}`, logCol, 'system');
    }

    // 4. GESTIÓN DE CAPITAL
    if (isWin) {
        this.equity += this.currentStake * 0.85;
        this.wins++;
        this.currentStake = V27_CONFIG.TRADING.MIN_BET;
        this.martingaleLevel = 0;
    } else {
        this.equity -= this.currentStake;
        this.losses++;
        if (this.martingaleLevel < V27_CONFIG.TRADING.MAX_MARTINGALE) {
            this.martingaleLevel++;
            this.currentStake = Math.ceil(this.currentStake * V27_CONFIG.TRADING.MARTINGALE_MULTIPLIER);
            if (window.UIManager) {
                UIManager.addLog(`Martingale N${this.martingaleLevel}: $${this.currentStake}`, '#ffb400', 'system');
            }
        } else {
            this.currentStake = V27_CONFIG.TRADING.MIN_BET;
            this.martingaleLevel = 0;
        }
    }
    
    this.totalTrades++;

    // 5. ACTUALIZAR SECUENCIA
    window.sequence.push({ 
        val: actual,
        prediction: prediction,
        timestamp: Date.now() 
    });
    if (window.sequence.length > 40) window.sequence.shift();
    
    // 6. ACTUALIZAR INDICADORES
    const lastPrice = this.priceHistory.length > 0 ? this.priceHistory[this.priceHistory.length - 1] : 100;
    this.technicalIndicators.update({
        close: actual === 'A' ? lastPrice + 1 : lastPrice - 1,
        high: lastPrice + 1.5, 
        low: lastPrice - 1.5, 
        volume: 1000
    });

    this.updateStreak(actual);
    this.runMultiAnalysis();
    
    if (window.UIManager) {
        UIManager.updateWealthUI(this.equity);
        UIManager.updateVisualTrack(window.sequence);
    }

    // 7. EVALUACIÓN DE RIESGO - SOLO DESPUÉS DE 5 TRADES Y CON DATOS VÁLIDOS
    if (this.totalTrades >= 5 && this.riskOverlay) {
        const vol = this.calculateVolatility();
        
        if (!isNaN(vol) && vol >= 0) {
            const check = this.riskOverlay.evaluate(
                { size: this.currentStake },
                { volatility: vol },
                { 
                    equity: this.equity || 1000, 
                    positions: [], 
                    peak: Math.max(1000, this.equity || 1000)
                }
            );
            
            if (!check.approved) {
                this.isLocked = true;
                if (window.UIManager) {
                    UIManager.addLog('🛑 SISTEMA BLOQUEADO POR RIESGO', '#ff4d82', 'risk');
                }
            }
        }
    }

    // 8. ACTUALIZAR GRÁFICO
    if (typeof window.updateAccuracyChart === 'function' && this.totalTrades > 0) {
        const acc = this.wins / this.totalTrades;
        const vol = this.calculateVolatility();
        if (!isNaN(acc) && !isNaN(vol)) {
            window.updateAccuracyChart(acc, vol);
        }
    }
    

},
    
    updateStreak(actual) {
        if (this.currentStreak.val === actual) {
            this.currentStreak.count++;
        } else {
            this.currentStreak.val = actual;
            this.currentStreak.count = 1;
        }
    },
    
    calculateGlobalAccuracy() {
        if (this.totalTrades === 0) return 0;
        return this.wins / this.totalTrades;
    },
    
    calculateVolatility() {
        if (this.sequence.length < 10) return 0;
        const last10 = this.sequence.slice(-10).map(v => v.val === 'A' ? 1 : 0);
        const mean = last10.reduce((a, b) => a + b, 0) / 10;
        const variance = last10.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / 10;
        return Math.sqrt(variance) * 100;
    },
    
    runMultiAnalysis() {
        const history = this.sequence.map(v => v.val).join('');
        
        for (let v = 3; v <= 20; v++) {
            if (this.sequence.length < v) continue;
            
            const pattern = history.slice(-v);
            const searchPool = history.slice(0, -1);
            const mA = (searchPool.match(new RegExp(pattern + 'A', 'g')) || []).length;
            const mB = (searchPool.match(new RegExp(pattern + 'B', 'g')) || []).length;
            
            let pred = mA > mB ? "BUY" : (mB > mA ? "SELL" : "---");
            this.predictions[v] = pred;
            
            if (pred !== "---") {
                this.stats[v].total++;
                // Verificar si acertó (necesitaríamos el resultado actual)
            }
        }
        
        this.findGeneticMatch();
    },
    
    findGeneticMatch() {
        let bestV = null;
        let maxWeight = -1;
        const history = this.sequence.map(v => v.val).join('');
        
        for (let v = 3; v <= 20; v++) {
            if (this.sequence.length < v) continue;
            
            const stats = this.stats[v];
            const accuracy = stats.total > 0 ? (stats.hits / stats.total) : 0;
            
            const pattern = history.slice(-v);
            const searchPool = history.slice(0, -1);
            const occurrences = (searchPool.match(new RegExp(pattern, 'g')) || []).length;
            const recentHits = stats.timeline.slice(-5).filter(s => s.success).length;
            
            const weight = (accuracy * 0.6) + (recentHits * 0.3) + (occurrences * 0.1);
            
            if (weight > maxWeight && this.predictions[v] !== "---") {
                maxWeight = weight;
                bestV = v;
            }
        }
        
        if (bestV) {
            this.signals.geneticLeader = {
                pattern: `V${bestV}`,
                signal: this.predictions[bestV],
                confidence: maxWeight * 100
            };
        }
    },
    
    async predictAdvanced() {
    console.log('🧠 [ML] Intentando predicción...');
    
    // Verificar requisitos
    if (!window.tf) {
        console.warn('🧠 [ML] TensorFlow no disponible');
        this.signals.ml = { direction: 'NEUTRAL', confidence: 0, probability: 0.5, error: 'NO_TF' };
        return this.signals.ml;
    }
    
    if (this.sequence.length < V27_CONFIG.ML.LSTM.WINDOW_SIZE) {
        console.log(`🧠 [ML] Datos insuficientes: ${this.sequence.length}/${V27_CONFIG.ML.LSTM.WINDOW_SIZE}`);
        this.signals.ml = { direction: 'NEUTRAL', confidence: 0, probability: 0.5, error: 'INSUFFICIENT_DATA' };
        return this.signals.ml;
    }
    
    if (!this.frozenBackbone || !this.frozenBackbone.model) {
        console.warn('🧠 [ML] Modelo no inicializado');
        this.signals.ml = { direction: 'NEUTRAL', confidence: 0, probability: 0.5, error: 'NO_MODEL' };
        return this.signals.ml;
    }
    
    try {
        // Preparar datos CORRECTAMENTE para tensor3d
        // Necesitamos: [batch_size=1, window_size=30, features=1]
        const rawSeq = this.sequence.slice(-V27_CONFIG.ML.LSTM.WINDOW_SIZE);
        
        // Convertir a array de números 0/1
        const seqArray = rawSeq.map(v => v.val === 'A' ? 1 : 0);
        
        console.log('🧠 [ML] Secuencia raw:', seqArray.slice(-5), '...');
        
        // Crear tensor3d con forma explícita [1, 30, 1]
        // Primero crear el array 3D manualmente
        const tensorData = new Float32Array(seqArray);
        
        // Usar reshape explícito
        const input = tf.tensor(tensorData, [1, V27_CONFIG.ML.LSTM.WINDOW_SIZE, 1]);
        
        console.log('🧠 [ML] Tensor creado:', input.shape);
        
        // Predecir
        const prediction = await this.bayesianEnsemble.predict(input);
        
        // Liberar tensor
        input.dispose();
        
        console.log('🧠 [ML] Predicción:', prediction);
        
        // Consultar escudo
        const context = {
            features: { 
                volatility: this.calculateVolatility() / 100,
                momentum: this.signals.technical?.momentumScore || 0
            },
            timing: Date.now()
        };
        
        const shield = this.adversarialShield.check(
            prediction.probability > 0.5 ? 'A' : 'B', 
            null, 
            context
        );
        
        // Aplicar decisión del escudo
        let finalDirection = prediction.direction;
        let finalConfidence = prediction.confidence;
        
        if (shield.isAdversarial && shield.confidence > 0.7) {
            finalDirection = finalDirection === 'BUY' ? 'SELL' : finalDirection === 'SELL' ? 'BUY' : 'NEUTRAL';
            finalConfidence *= 0.8;
            this.trapsAvoided++;
            console.log('🛡️ [Shield] Inversión aplicada por trampa detectada');
        }
        
        this.signals.ml = {
            ...prediction,
            direction: finalDirection,
            confidence: finalConfidence,
            shieldTriggered: shield.isAdversarial,
            shieldConfidence: shield.confidence
        };
        
        console.log('🧠 [ML] Señal final:', this.signals.ml);
        
        return this.signals.ml;
        
    } catch (e) {
        console.error('🧠 [ML] Error en predicción:', e);
        this.signals.ml = { direction: 'NEUTRAL', confidence: 0, probability: 0.5, error: e.message };
        return this.signals.ml;
    }
},
    
    startUpdateLoops() {
        // Actualizar indicadores técnicos
        setInterval(() => {
            if (this.sequence.length > 5) {
                this.signals.technical = this.technicalIndicators.getAllSignals();
            }
        }, 1000);
        
        // Actualizar predicción ML
        setInterval(async () => {
            if (this.sequence.length >= V27_CONFIG.ML.LSTM.WINDOW_SIZE) {
                await this.predictAdvanced();
            }
        }, 2000);
        
        // Actualizar régimen
        setInterval(() => {
            const vol = this.calculateVolatility();
            const trend = this.signals.technical?.momentumScore || 0;
            const adx = this.signals.technical?.adx?.adx || 25;
            
            const regime = this.regimeDetector.detect(vol, trend, adx);
            this.signals.regime = regime;
        }, 5000);
        
        // Actualizar UI periódicamente
        setInterval(() => this.updateAllUI(), 1000);
    },
    
// Agregar esta función a MarketBridgeV27
// Agregar esta función a MarketBridgeV27
updateGeneticWindows() {
    const colLow = document.querySelector('#col-low .windows-container');
    const colMid = document.querySelector('#col-mid .windows-container');
    const colHigh = document.querySelector('#col-high .windows-container');
    
    if (!colLow || !colMid || !colHigh) return;
    
    // Limpiar contenedores
    colLow.innerHTML = '';
    colMid.innerHTML = '';
    colHigh.innerHTML = '';
    
    // Clasificar ventanas V3-V20 por confianza
    for (let v = 3; v <= 20; v++) {
        const stats = this.stats[v];
        const prediction = this.predictions[v];
        
        if (!prediction || prediction === '---') continue;
        
        // Calcular confianza basada en precisión histórica
        let confidence = 0;
        if (stats.total > 0) {
            confidence = (stats.hits / stats.total) * 100;
        }
        
        // Crear elemento de ventana
        const windowEl = document.createElement('div');
        windowEl.style.cssText = `
            padding: 6px 8px;
            margin: 4px 0;
            border-radius: 4px;
            font-size: 11px;
            font-family: 'JetBrains Mono', monospace;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: ${prediction === 'BUY' ? 'rgba(0, 255, 170, 0.1)' : 'rgba(255, 77, 130, 0.1)'};
            border-left: 3px solid ${prediction === 'BUY' ? '#00ffaa' : '#ff4d82'};
        `;
        
        windowEl.innerHTML = `
            <span style="color: ${prediction === 'BUY' ? '#00ffaa' : '#ff4d82'}; font-weight: bold;">
                V${v}
            </span>
            <span style="color: #888; font-size: 10px;">
                ${confidence > 0 ? confidence.toFixed(0) + '%' : 'N/A'}
            </span>
        `;
        
        // Clasificar por confianza
        if (confidence >= 60 || (stats.total >= 5 && confidence >= 50)) {
            colHigh.appendChild(windowEl);
        } else if (confidence >= 40 || stats.total >= 3) {
            colMid.appendChild(windowEl);
        } else {
            colLow.appendChild(windowEl);
        }
    }
    
    // Si no hay elementos, mostrar mensaje
    [colLow, colMid, colHigh].forEach(col => {
        if (col.children.length === 0) {
            col.innerHTML = '<div style="color: #555; font-size: 10px; text-align: center; padding: 10px;">Sin datos</div>';
        }
    });
},


  updateAllUI() {
    // 1. Actualizar Wealth (Dinero)
    const eqEl = document.getElementById('equity-value');
    if (eqEl) {
        eqEl.textContent = `$${this.equity.toFixed(2)}`;
        eqEl.style.color = this.equity >= 1000 ? '#00ffaa' : '#ff4d82';
    }
    
    // 2. NUEVA LOGICA: Actualizar secuencia visual (Comparador YO vs IA)
    if (window.UIManager && typeof window.UIManager.updateVisualTrack === 'function') {
        window.UIManager.updateVisualTrack(this.sequence);
    }
    
    // 3. Actualizar contador de longitud
    const seqLen = document.getElementById('seq-length');
    if (seqLen) seqLen.textContent = `Longitud: ${this.sequence.length} velas`;
    
    // 4. Actualizar indicadores técnicos en UI
    if (this.signals.technical) {
        const tech = this.signals.technical;
        
        const rsiEl = document.getElementById('v27-rsi');
        const rsiBar = document.getElementById('rsi-bar');
        const rsiSignal = document.getElementById('rsi-signal');
        
        if (rsiEl) rsiEl.textContent = tech.rsi.value.toFixed(1);
        if (rsiBar) {
            rsiBar.style.width = Math.min(100, tech.rsi.value) + '%';
            rsiBar.className = 'bar-fill ' + (tech.rsi.value > 70 ? 'overbought' : tech.rsi.value < 30 ? 'oversold' : '');
        }
        if (rsiSignal) rsiSignal.textContent = tech.rsi.state;
        
        const macdEl = document.getElementById('v27-macd');
        const macdBar = document.getElementById('macd-bar');
        if (macdEl) macdEl.textContent = tech.macd.histogram.toFixed(3);
        if (macdBar) macdBar.style.width = (50 + tech.macd.histogram * 50) + '%';
        
        const bbEl = document.getElementById('v27-bb');
        if (bbEl) bbEl.textContent = tech.bollinger.bandwidth.toFixed(1) + '%';
        
        const streakEl = document.getElementById('v27-streak');
        if (streakEl) {
            const streakText = this.currentStreak.val ? 
                (this.currentStreak.val === 'A' ? 'ALCISTA' : 'BAJISTA') + ` (${this.currentStreak.count})` : 
                '--';
            streakEl.textContent = streakText;
        }
        
        const compositeEl = document.getElementById('tech-composite');
        if (compositeEl) {
            let signal = 'NEUTRAL';
            let className = 'neutral';
            
            if (tech.momentumScore > 50) { signal = 'COMPRA FUERTE'; className = 'buy'; }
            else if (tech.momentumScore > 20) { signal = 'COMPRA'; className = 'buy'; }
            else if (tech.momentumScore < -50) { signal = 'VENTA FUERTE'; className = 'sell'; }
            else if (tech.momentumScore < -20) { signal = 'VENTA'; className = 'sell'; }
            
            compositeEl.textContent = signal;
            compositeEl.className = 'composite-value ' + className;
        }
        
        const momentumEl = document.getElementById('tech-momentum');
        if (momentumEl) momentumEl.textContent = `Momentum: ${tech.momentumScore > 0 ? '+' : ''}${tech.momentumScore}`;
    }

    // Actualizar panel ML
    if (this.signals.ml) {
        const mlDir = document.getElementById('ml-direction');
        const mlConf = document.getElementById('ml-confidence');
        const mlRegime = document.getElementById('ml-regime');
        
        if (mlDir) {
            mlDir.textContent = this.signals.ml.direction;
            mlDir.className = 'pred-direction ' + (this.signals.ml.direction === 'BUY' ? 'buy' : this.signals.ml.direction === 'SELL' ? 'sell' : 'neutral');
        }
        if (mlConf) mlConf.textContent = (this.signals.ml.confidence * 100).toFixed(1) + '%';
        if (mlRegime) mlRegime.textContent = 'Estado: ' + (this.signals.regime?.regime || 'ANALIZANDO');
        
        const mlAcc = document.getElementById('ml-accuracy');
        if (mlAcc) mlAcc.textContent = (this.calculateGlobalAccuracy() * 100).toFixed(1) + '%';
    }
    
    // Actualizar panel genético
    if (this.signals.geneticLeader) {
        const bestMatch = document.getElementById('ai-best-match');
        const signalVal = document.getElementById('ai-signal-value');
        const conf = document.getElementById('ai-confidence');
        
        if (bestMatch) bestMatch.textContent = `PATRON LÍDER: ${this.signals.geneticLeader.pattern}`;
        if (signalVal) {
            signalVal.textContent = this.signals.geneticLeader.signal;
            signalVal.style.color = this.signals.geneticLeader.signal === 'BUY' ? '#00ffaa' : '#ff4d82';
        }
        if (conf && this.signals.geneticLeader) conf.textContent = `${this.signals.geneticLeader.confidence.toFixed(1)}% CONFIANZA`;
    }
    
    // ← AGREGAR ESTA LÍNEA AQUÍ
    this.updateGeneticWindows();
    
    // Actualizar panel de trampas
    const trapCount = document.getElementById('trap-count');
    const trapAvoided = document.getElementById('trap-avoided');
    const trapThreshold = document.getElementById('trap-threshold');
    const shieldProb = document.getElementById('shield-prob');
    const shieldState = document.getElementById('shield-state');
    const shieldIcon = document.getElementById('shield-icon');
    
    if (trapCount) trapCount.textContent = this.traps.length;
    if (trapAvoided) trapAvoided.textContent = this.trapsAvoided;
    if (trapThreshold) trapThreshold.textContent = this.dynamicTrapThreshold.toFixed(2);
    
    const trapProb = this.signals.ml?.uncertainty ? (this.signals.ml.uncertainty * 100) : 0;
    if (shieldProb) shieldProb.textContent = `Prob. Trampa: ${trapProb.toFixed(1)}%`;
    
    if (shieldState) {
        const isTriggered = trapProb > 65;
        shieldState.textContent = isTriggered ? 'TRAMPA DETECTADA' : 'ESCUDO ACTIVO';
        shieldState.className = 'shield-state ' + (isTriggered ? 'triggered' : 'active');
        if (shieldIcon) shieldIcon.textContent = isTriggered ? '⚠️' : '🛡️';
    }
    
    // Actualizar panel de riesgo
    const volGauge = document.getElementById('vol-gauge');
    const volValue = document.getElementById('vol-value');
    const vol = this.calculateVolatility();
    
    if (volGauge) {
        const offset = 220 - (Math.min(vol * 10, 100) / 100 * 220);
        volGauge.style.strokeDashoffset = offset;
        volGauge.className = 'gauge-fill ' + (vol > 8 ? 'danger' : vol > 5 ? 'warning' : '');
    }
    if (volValue) volValue.textContent = vol.toFixed(1) + '%';
    
    // Checks de riesgo
    const checkVol = document.getElementById('check-vol');
    const statusVol = document.getElementById('status-vol');
    if (checkVol && statusVol) {
        const volPass = vol < 8;
        checkVol.textContent = volPass ? '✓' : '✗';
        checkVol.className = 'check-icon ' + (volPass ? '' : 'fail');
        statusVol.textContent = volPass ? 'PASS' : 'ALERTA';
        statusVol.className = 'check-status ' + (volPass ? 'pass' : 'fail');
    }
    
    const checkStreak = document.getElementById('check-streak');
    const statusStreak = document.getElementById('status-streak');
    if (checkStreak && statusStreak) {
        const streakPass = this.currentStreak.count < 7;
        checkStreak.textContent = streakPass ? '✓' : '✗';
        checkStreak.className = 'check-icon ' + (streakPass ? '' : 'fail');
        statusStreak.textContent = streakPass ? 'PASS' : 'EXTREMA';
        statusStreak.className = 'check-status ' + (streakPass ? 'pass' : 'fail');
    }
    
    // Circuit breaker
    const circuit = document.getElementById('circuit-breaker');
    if (circuit) {
        const isActive = this.isLocked || this.isPaused;
        circuit.innerHTML = isActive ?
            '<span class="cb-icon">🔒</span><span class="cb-text">CIRCUIT BREAKER: ACTIVO</span>' :
            '<span class="cb-icon">🛡️</span><span class="cb-text">CIRCUIT BREAKER: INACTIVO</span>';
        circuit.className = 'circuit-breaker-status ' + (isActive ? 'triggered' : '');
    }
    
    // Confluence bar
    const confBuy = document.getElementById('conf-buy');
    const confSell = document.getElementById('conf-sell');
    const vLabel = document.getElementById('v-label');
    
    let buyCount = 0, sellCount = 0;
    for (let v = 3; v <= 20; v++) {
        if (this.predictions[v] === 'BUY') buyCount++;
        else if (this.predictions[v] === 'SELL') sellCount++;
    }
    
    if (confBuy) confBuy.textContent = `BUY: ${buyCount}`;
    if (confSell) confSell.textContent = `SELL: ${sellCount}`;
    if (vLabel) {
        const rsi = this.signals.technical?.rsi?.value || 50;
        vLabel.textContent = `ASERTIVIDAD: ${(this.calculateGlobalAccuracy() * 100).toFixed(0)}% | RSI: ${Math.round(rsi)} | RACHA: ${this.currentStreak.count}`;
    }
    
    // Señal principal
    const signalSide = document.getElementById('signal-side');
    if (signalSide) {
        let mainSignal = 'ESPERANDO DATOS';
        let color = '#888';
        
        if (this.signals.ml && this.signals.ml.direction !== 'NEUTRAL') {
            mainSignal = this.signals.ml.direction;
            color = this.signals.ml.direction === 'BUY' ? '#00ffaa' : '#ff4d82';
        } else if (this.signals.geneticLeader) {
            mainSignal = this.signals.geneticLeader.signal;
            color = this.signals.geneticLeader.signal === 'BUY' ? '#00ffaa' : '#ff4d82';
        }
        
        signalSide.textContent = mainSignal;
        signalSide.style.color = color;
    }
    
    // Régimen badge
    const regimeBadge = document.getElementById('v27-regime-badge');
    if (regimeBadge && this.signals.regime) {
        const regime = this.signals.regime.regime;
        regimeBadge.textContent = `RÉGIMEN: ${regime}`;
        regimeBadge.className = '';
        if (regime === 'TREND') regimeBadge.classList.add('trend');
        else if (regime === 'RANGE') regimeBadge.classList.add('range');
        else if (regime === 'HIGH_VOL') regimeBadge.classList.add('high-vol');
        else if (regime === 'CRISIS') regimeBadge.classList.add('crisis');
    }
    
    // Botones de stake
    const stakeBuy = document.getElementById('stake-buy');
    const stakeSell = document.getElementById('stake-sell');
    if (stakeBuy) stakeBuy.textContent = this.currentStake.toFixed(0);
    if (stakeSell) stakeSell.textContent = this.currentStake.toFixed(0);

    // === ACTUALIZACIÓN DEL GRÁFICO (CHART) ===
    const currentAcc = this.calculateGlobalAccuracy();
    const currentVol = this.calculateVolatility();

    if (typeof window.updateAccuracyChart === 'function') {
        window.updateAccuracyChart(currentAcc, currentVol);
    }
},
    
    addLog(msg, color = '#aaa', type = 'system') {
        // Log interno
        console.log(`[${type}] ${msg}`);
        
        // UI log
        const logLines = document.getElementById('log-lines');
        if (logLines) {
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            const ts = new Date().toLocaleTimeString();
            entry.innerHTML = `
                <span class="log-time">${ts}</span>
                <span class="log-type log-type-${type}">${type}</span>
                <span class="log-msg" style="color:${color}">${msg}</span>
            `;
            logLines.prepend(entry);
            if (logLines.children.length > 100) logLines.removeChild(logLines.lastChild);
        }
        
        // Wealth log
        const wealthLog = document.getElementById('wealth-log');
        if (wealthLog) {
            wealthLog.textContent = msg.substring(0, 40);
            wealthLog.style.color = color;
        }
    },
    
    // Toggle methods
    toggleReversal() {
        this.isManualReversal = !this.isManualReversal;
        const status = document.getElementById('rev-status');
        const btn = document.getElementById('toggle-reversal');
        
        if (status) status.textContent = this.isManualReversal ? 'ON (AUTO)' : 'OFF (MANUAL)';
        if (btn) btn.classList.toggle('active');
        
        this.addLog(`Reversión ${this.isManualReversal ? 'activada' : 'desactivada'}`, '#00d4ff', 'system');
    },
    
    toggleTrapMechanism() {
        const btn = document.getElementById('toggle-trap-mechanism');
        if (btn) {
            const isActive = !btn.classList.contains('active');
            btn.classList.toggle('active');
            const sub = btn.querySelector('.btn-sub');
            if (sub) sub.textContent = isActive ? 'ACTIVADO' : 'DESACTIVADO';
            this.addLog(`Detector de trampas ${isActive ? 'activado' : 'desactivado'}`, '#00d4ff', 'system');
        }
    },
    
    toggleHedgeFund() {
        V27_CONFIG.HEDGE.ENABLED = !V27_CONFIG.HEDGE.ENABLED;
        const btn = document.getElementById('toggle-hedge-fund');
        if (btn) {
            btn.classList.toggle('active');
            const sub = btn.querySelector('.btn-sub');
            if (sub) sub.textContent = V27_CONFIG.HEDGE.ENABLED ? 'ACTIVADO' : 'DESACTIVADO';
        }
        this.addLog(`Hedge Fund ${V27_CONFIG.HEDGE.ENABLED ? 'activado' : 'desactivado'}`, '#00d4ff', 'system');
    },
    
    togglePOConnection() {
        const btn = document.getElementById('toggle-po-connection');
        const status = document.getElementById('po-status');
        
        if (btn && status) {
            const isOnline = status.textContent === 'ONLINE';
            status.textContent = isOnline ? 'OFFLINE' : 'ONLINE';
            status.style.color = isOnline ? '#888' : '#00ffaa';
            btn.classList.toggle('active');
            this.addLog(`PO Socket ${isOnline ? 'desconectado' : 'conectado'}`, '#00d4ff', 'system');
        }
    },
    
          reset() {
        this.equity = 1000;
        this.currentStake = 10;
        this.isLocked = false;
        this.isPaused = false;
        this.sequence = [];
        window.sequence = [];
        this.currentStreak = { val: null, count: 0 };
        this.priceHistory = [];
        this.predictions = {};
        this.traps = [];
        this.wins = 0;
        this.losses = 0;
        this.totalTrades = 0;
        this.martingaleLevel = 0;
        
        for (let i = 3; i <= 20; i++) {
            this.stats[i] = { hits: 0, total: 0, timeline: [] };
        }
        
        // Llama al reset de RiskOverlay
        if (this.riskOverlay) {
            this.riskOverlay.reset();
        }
        
        this.addLog('Sistema reiniciado', '#00d4ff', 'system');
        this.updateAllUI();
    },

    exportData() {
        const data = this.ledger ? this.ledger.getHistory() : [];
        if (data.length === 0) {
            this.addLog('No hay datos para exportar', '#ffb400', 'system');
            return;
        }
        
        const csv = 'timestamp,type,direction,stake,equity\n' + 
            data.map(d => `${d.timestamp},${d.data.type},${d.data.direction},${d.data.stake},${this.equity}`).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quantum_v27_trades_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.addLog('Datos exportados a CSV', '#00ffaa', 'system');
    }
};

// UI Manager V27 - REVISIÓN ANTI-OCULTAMIENTO
const UIManager = {
    updateWealthUI: (equity) => {
        const el = document.getElementById('equity-value');
        if (el) {
            el.textContent = `$${parseFloat(equity).toFixed(2)}`;
            el.style.color = equity >= 1000 ? '#00ffaa' : '#ff4d82';
        }
    },
    
    addLog: (msg, color, type) => MarketBridgeV27.addLog(msg, color, type),
    
    updateVisualTrack: (sequence) => {
        const track = document.getElementById('live-sequence');
        if (!track || !Array.isArray(sequence)) return;

        // --- FORZAR VISIBILIDAD DEL CONTENEDOR ---
        track.style.display = "flex";
        track.style.opacity = "1";
        track.style.visibility = "visible";
        track.style.minHeight = "100px"; // Asegura que no colapse a 0px
        track.style.flexDirection = "column";
        track.style.gap = "12px";
        track.style.padding = "10px";
        track.style.overflowX = "auto"; // Si hay muchas, permite scroll horizontal
        track.style.overflowY = "hidden";
        track.innerHTML = ""; 

        const userRow = document.createElement('div');
        const iaRow = document.createElement('div');
        
[userRow, iaRow].forEach((row, i) => {
    row.style.display = "flex";
    row.style.flexDirection = "row";
    row.style.alignItems = "center";
    row.style.justifyContent = "flex-start"; // <--- CLAVE: Empuja todo a la izquierda
    row.style.gap = "6px";
    row.style.width = "max-content";         // <--- CLAVE: La fila solo mide lo que midan sus velas
    row.style.minWidth = "100%";             // Permite que el fondo se vea completo pero no estira hijos
    row.style.overflow = "hidden";
    row.style.flexWrap = "nowrap";
            
            const label = document.createElement('span');
            label.innerText = i === 0 ? "YO" : "IA";
            label.style.width = "35px";
            label.style.minWidth = "35px";
            label.style.fontSize = "10px";
            label.style.fontWeight = "bold";
            label.style.color = i === 0 ? "#00d4ff" : "#888";
            row.appendChild(label);
        });

        // Solo procesamos si hay datos, si no, ponemos un aviso
        if (sequence.length === 0) {
            track.innerHTML = "<small style='color:#666; padding:20px'>Esperando secuencia...</small>";
            return;
        }

        sequence.slice(-16).forEach(item => {
            const candleBase = {
                width: "18px",
                height: "18px",
                minWidth: "18px",
                maxWidth: "18px",
                borderRadius: "3px",
                flexShrink: "0"
            };

            // Punto Usuario
            const dotU = document.createElement('div');
            Object.assign(dotU.style, candleBase);
            dotU.style.background = item.prediction === 'A' ? "#00ffaa" : "#ff4d82";
            userRow.appendChild(dotU);

            // Punto IA
            const dotIA = document.createElement('div');
            Object.assign(dotIA.style, candleBase);
            dotIA.style.background = item.val === 'A' ? "#00ffaa" : "#ff4d82";
            // Si el valor real aún no llega (null), lo ponemos gris
            if (!item.val) dotIA.style.background = "#333";
            
            const isHit = item.prediction === item.val;
            dotIA.style.opacity = isHit ? "1" : "0.3";
            iaRow.appendChild(dotIA);
        });

        track.appendChild(userRow);
        track.appendChild(iaRow);
    },
    
    updateStretchUI: (text, color) => {
        const el = document.getElementById('stretch-warning');
        if (el) {
            el.textContent = text;
            el.style.color = color;
        }
    }
};

window.UIManager = UIManager;
window.MarketBridge = MarketBridgeV27; 
window.MarketBridgeV27 = MarketBridgeV27;

// Lógica de inicio de plataforma
document.addEventListener('DOMContentLoaded', () => {
    window.setPlatform = (mode) => {
        const selector = document.getElementById('device-selector');
        if (selector) selector.classList.add('selector-hidden');
        
        setTimeout(() => {
            if (selector) selector.style.display = 'none';
            const layout = document.getElementById('layout-wrapper');
            if (layout) layout.style.display = 'flex';

if (typeof initChart === 'function') {
    initChart();
}
            if (mode === 'mobile') document.body.classList.add('mobile-view');
            
            // Iniciar núcleo
            MarketBridgeV27.init();
        }, 800);
    };
});

console.log('✅ UIManager V27 Adaptado: Doble carril horizontal activado.');


// ==================== CHART PATTERN RECOGNITION ENGINE V27 ====================

class ChartPatternEngine {
    constructor(containerId = 'chart-pattern-monitor') {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            this.container = this.createContainer();
        }
        this.canvas = null;
        this.ctx = null;
        this.priceData = [];
        this.detectedPatterns = [];
        this.patternHistory = [];
        this.lastAnalyzedLength = 0;
        
        this.initCanvas();
        this.setupPatternLibrary();
        this.startAnalysisLoop();
    }
    
    createContainer() {
        const div = document.createElement('div');
        div.id = 'chart-pattern-monitor';
        div.className = 'v27-panel pattern-chart-panel';
        div.innerHTML = `
            <div class="panel-header">
                <span class="panel-title">📐 FIGURAS CHARTISTAS</span>
                <span class="panel-status live" id="pattern-status">ANALIZANDO</span>
            </div>
            <div class="pattern-main-display">
                <div class="chart-container">
                    <canvas id="chart-pattern-canvas"></canvas>
                </div>
                <div class="pattern-detection-panel">
                    <div class="active-pattern" id="active-pattern">
                        <div class="no-pattern">
                            <div class="scan-icon">🔍</div>
                            <div>Buscando figuras...</div>
                            <div class="min-velas">Mínimo 8 velas</div>
                        </div>
                    </div>
                    <div class="pattern-matches" id="pattern-matches"></div>
                </div>
            </div>
        `;
        
        const dashboard = document.querySelector('.v27-dashboard');
        if (dashboard) {
            dashboard.insertBefore(div, dashboard.firstChild);
        }
        
        return div;
    }
    
    initCanvas() {
        this.canvas = document.getElementById('chart-pattern-canvas');
        if (!this.canvas) return;
        
        this.canvas.width = 600;
        this.canvas.height = 300;
        this.ctx = this.canvas.getContext('2d');
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
    }
    
    setupPatternLibrary() {
        this.patterns = {
            'DOUBLE_TOP': {
                name: 'Doble Techo',
                type: 'REVERSIÓN BAJISTA',
                icon: '⬇️',
                minBars: 8,
                detect: (data) => this.detectDoubleTop(data),
                stats: { successRate: 0.74, avgMove: 0.16, direction: 'B' },
                color: '#ff4d82'
            },
            'DOUBLE_BOTTOM': {
                name: 'Doble Suelo',
                type: 'REVERSIÓN ALCISTA',
                icon: '⬆️',
                minBars: 8,
                detect: (data) => this.detectDoubleBottom(data),
                stats: { successRate: 0.72, avgMove: 0.15, direction: 'A' },
                color: '#00ffaa'
            },
            'HEAD_SHOULDERS': {
                name: 'Hombro-Cabeza-Hombro',
                type: 'REVERSIÓN BAJISTA',
                icon: '👤',
                minBars: 12,
                detect: (data) => this.detectHeadShoulders(data),
                stats: { successRate: 0.76, avgMove: 0.19, direction: 'B' },
                color: '#ff6b6b'
            },
            'CUP_HANDLE': {
                name: 'Taza con Asa',
                type: 'CONTINUACIÓN',
                icon: '☕',
                minBars: 15,
                detect: (data) => this.detectCupAndHandle(data),
                stats: { successRate: 0.68, avgMove: 0.12, direction: 'A' },
                color: '#00d4ff'
            },
            'ASCENDING_TRIANGLE': {
                name: 'Triángulo Ascendente',
                type: 'CONTINUACIÓN ALCISTA',
                icon: '🔺',
                minBars: 10,
                detect: (data) => this.detectAscendingTriangle(data),
                stats: { successRate: 0.75, avgMove: 0.18, direction: 'A' },
                color: '#00ff88'
            },
            'DESCENDING_TRIANGLE': {
                name: 'Triángulo Descendente',
                type: 'CONTINUACIÓN BAJISTA',
                icon: '🔻',
                minBars: 10,
                detect: (data) => this.detectDescendingTriangle(data),
                stats: { successRate: 0.73, avgMove: 0.17, direction: 'B' },
                color: '#ff4757'
            },
            'RECTANGLE': {
                name: 'Rectángulo',
                type: 'CONSOLIDACIÓN',
                icon: '⬜',
                minBars: 10,
                detect: (data) => this.detectRectangle(data),
                stats: { successRate: 0.65, avgMove: 0.10, direction: 'NEUTRAL' },
                color: '#ffb400'
            }
        };
    }
    
    // Algoritmos de detección simplificados
    detectDoubleTop(data) {
        if (data.length < 8) return { detected: false, confidence: 0 };
        const recent = data.slice(-15);
        const highs = recent.map(d => d.high);
        const max1 = Math.max(...highs.slice(0, 8));
        const max2 = Math.max(...highs.slice(7));
        const similarity = 1 - Math.abs(max1 - max2) / max1;
        const detected = similarity > 0.95 && max1 > Math.min(...recent.map(d => d.low)) * 1.05;
        return { detected, confidence: similarity * 0.8 };
    }
    
    detectDoubleBottom(data) {
        if (data.length < 8) return { detected: false, confidence: 0 };
        const recent = data.slice(-15);
        const lows = recent.map(d => d.low);
        const min1 = Math.min(...lows.slice(0, 8));
        const min2 = Math.min(...lows.slice(7));
        const similarity = 1 - Math.abs(min1 - min2) / min1;
        const detected = similarity > 0.95 && min1 < Math.max(...recent.map(d => d.high)) * 0.95;
        return { detected, confidence: similarity * 0.8 };
    }
    
    detectHeadShoulders(data) {
        if (data.length < 12) return { detected: false, confidence: 0 };
        const recent = data.slice(-20);
        const highs = recent.map((d, i) => ({ price: d.high, idx: i }));
        const sorted = [...highs].sort((a, b) => b.price - a.price);
        if (sorted.length < 3) return { detected: false, confidence: 0 };
        const head = sorted[0];
        const shoulders = sorted.slice(1, 3);
        const valid = shoulders.every(s => s.price > head.price * 0.85 && s.price < head.price * 0.98);
        const left = shoulders.find(s => s.idx < head.idx);
        const right = shoulders.find(s => s.idx > head.idx);
        const detected = valid && left && right;
        return { detected, confidence: detected ? 0.75 : 0 };
    }
    
    detectCupAndHandle(data) {
        if (data.length < 15) return { detected: false, confidence: 0 };
        const prices = data.slice(-20).map(d => d.close);
        const minIdx = prices.indexOf(Math.min(...prices));
        const firstDrop = (prices[0] - prices[minIdx]) / prices[0];
        const lastRise = (prices[prices.length - 1] - prices[minIdx]) / prices[minIdx];
        const detected = minIdx > 5 && minIdx < 15 && firstDrop > 0.05 && lastRise > firstDrop * 0.7;
        return { detected, confidence: detected ? 0.7 : 0 };
    }
    
    detectAscendingTriangle(data) {
        if (data.length < 10) return { detected: false, confidence: 0 };
        const recent = data.slice(-15);
        const highs = recent.map(d => d.high);
        const lows = recent.map(d => d.low);
        const resistance = Math.max(...highs);
        const touches = highs.filter(h => h > resistance * 0.99).length;
        const rising = lows[lows.length - 1] > lows[0];
        const detected = touches >= 2 && rising;
        return { detected, confidence: detected ? 0.75 : 0 };
    }
    
    detectDescendingTriangle(data) {
        if (data.length < 10) return { detected: false, confidence: 0 };
        const recent = data.slice(-15);
        const highs = recent.map(d => d.high);
        const lows = recent.map(d => d.low);
        const support = Math.min(...lows);
        const touches = lows.filter(l => l < support * 1.01).length;
        const falling = highs[highs.length - 1] < highs[0];
        const detected = touches >= 2 && falling;
        return { detected, confidence: detected ? 0.75 : 0 };
    }
    
    detectRectangle(data) {
        if (data.length < 10) return { detected: false, confidence: 0 };
        const recent = data.slice(-20);
        const highs = recent.map(d => d.high);
        const lows = recent.map(d => d.low);
        const range = Math.max(...highs) - Math.min(...lows);
        const avg = recent.reduce((a, b) => a + b.close, 0) / recent.length;
        const detected = range / avg < 0.08;
        return { detected, confidence: detected ? 0.6 : 0 };
    }
    
    convertSequenceToOHLC(sequence) {
        if (!sequence || sequence.length === 0) return [];
        let basePrice = 100;
        return sequence.map((item, i) => {
            const isA = item.val === 'A';
            const vol = 0.02;
            const open = basePrice;
            const close = isA ? basePrice * (1 + vol) : basePrice * (1 - vol);
            const high = Math.max(open, close) * 1.005;
            const low = Math.min(open, close) * 0.995;
            basePrice = close;
            return { open, high, low, close, val: item.val, timestamp: item.timestamp };
        });
    }
    
    analyze(sequence) {
        this.priceData = this.convertSequenceToOHLC(sequence);
        if (this.priceData.length < 5) return;
        
        const detected = [];
        for (const [key, pattern] of Object.entries(this.patterns)) {
            if (this.priceData.length < pattern.minBars) continue;
            const result = pattern.detect(this.priceData);
            if (result.detected && result.confidence > 0.6) {
                detected.push({ key, ...pattern, ...result, timestamp: Date.now() });
            }
        }
        
        detected.sort((a, b) => b.confidence - a.confidence);
        this.detectedPatterns = detected.slice(0, 2);
        
        this.draw();
        this.updateUI();
        
        if (detected.length > 0 && detected[0].confidence > 0.75) {
            this.triggerAlert(detected[0]);
        }
    }
    
    draw() {
        if (!this.ctx || this.priceData.length === 0) return;
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const padding = 40;
        
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(10, 10, 25, 0.5)';
        ctx.fillRect(0, 0, width, height);
        
        const prices = this.priceData.flatMap(d => [d.high, d.low]);
        const minPrice = Math.min(...prices) * 0.99;
        const maxPrice = Math.max(...prices) * 1.01;
        const range = maxPrice - minPrice;
        
        const candleWidth = (width - padding * 2) / this.priceData.length * 0.7;
        const spacing = (width - padding * 2) / this.priceData.length;
        
        this.priceData.forEach((d, i) => {
            const x = padding + i * spacing + spacing / 2;
            const yOpen = height - padding - ((d.open - minPrice) / range) * (height - padding * 2);
            const yClose = height - padding - ((d.close - minPrice) / range) * (height - padding * 2);
            const yHigh = height - padding - ((d.high - minPrice) / range) * (height - padding * 2);
            const yLow = height - padding - ((d.low - minPrice) / range) * (height - padding * 2);
            
            const color = d.val === 'A' ? '#00ffaa' : '#ff4d82';
            
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, yHigh);
            ctx.lineTo(x, yLow);
            ctx.stroke();
            
            ctx.fillStyle = color;
            const bodyTop = Math.min(yOpen, yClose);
            const bodyHeight = Math.abs(yClose - yOpen);
            ctx.fillRect(x - candleWidth/2, bodyTop, candleWidth, Math.max(bodyHeight, 2));
        });
    }
    
    updateUI() {
        const activeDiv = document.getElementById('active-pattern');
        const matchesDiv = document.getElementById('pattern-matches');
        if (!activeDiv) return;
        
        if (this.detectedPatterns.length === 0) {
            activeDiv.innerHTML = `
                <div class="no-pattern">
                    <div class="scan-icon">🔍</div>
                    <div>Buscando figuras...</div>
                    <div class="min-velas">${Math.min(...Object.values(this.patterns).map(p => p.minBars))} velas mínimo</div>
                </div>
            `;
            if (matchesDiv) matchesDiv.innerHTML = '';
            return;
        }
        
        const top = this.detectedPatterns[0];
        const prob = (top.stats.successRate * 100).toFixed(0);
        
        activeDiv.innerHTML = `
            <div class="pattern-detected ${top.stats.direction === 'A' ? 'bullish' : 'bearish'}">
                <div class="pattern-icon-large">${top.icon}</div>
                <div class="pattern-name-large">${top.name}</div>
                <div class="pattern-type">${top.type}</div>
                <div class="pattern-confidence-bar">
                    <div class="confidence-fill" style="width: ${top.confidence * 100}%"></div>
                    <span>${(top.confidence * 100).toFixed(0)}% MATCH</span>
                </div>
                <div class="pattern-projection">
                    <div class="target-info">
                        <span>Probabilidad ${top.stats.direction === 'A' ? 'alcista' : 'bajista'}:</span>
                        <span style="color: ${top.stats.direction === 'A' ? '#00ffaa' : '#ff4d82'}; font-weight: bold;">${prob}%</span>
                    </div>
                    <div class="target-value">Objetivo: ${(top.stats.avgMove * 100).toFixed(1)}%</div>
                </div>
            </div>
        `;
        
        if (matchesDiv && this.detectedPatterns.length > 1) {
            matchesDiv.innerHTML = this.detectedPatterns.slice(1).map(p => `
                <div class="match-item ${p.stats.direction === 'A' ? 'bullish' : 'bearish'}">
                    <span>${p.icon}</span>
                    <span>${p.name}</span>
                    <span>${(p.confidence * 100).toFixed(0)}%</span>
                </div>
            `).join('');
        }
    }
    
    triggerAlert(pattern) {
        if (window.MarketBridgeV27) {
            const dir = pattern.stats.direction === 'A' ? 'ALCISTA' : 'BAJISTA';
            const color = pattern.stats.direction === 'A' ? '#00ffaa' : '#ff4d82';
            MarketBridgeV27.addLog(`📐 ${pattern.name} detectado → ${dir}`, color, 'pattern');
        }
    }
    
    startAnalysisLoop() {
        setInterval(() => {
            if (window.sequence && window.sequence.length !== this.lastAnalyzedLength) {
                this.analyze(window.sequence);
                this.lastAnalyzedLength = window.sequence.length;
            }
        }, 1500);
    }
    
    getCurrentSignal() {
        if (this.detectedPatterns.length === 0) return null;
        const top = this.detectedPatterns[0];
        return {
            pattern: top.name,
            direction: top.stats.direction,
            confidence: top.confidence
        };
    }
}

// ==================== INTEGRACIÓN FINAL ====================

// Esperar a que todo esté cargado
setTimeout(() => {
    if (window.MarketBridgeV27) {
        // Crear instancia del motor de patrones
        window.chartPatternEngine = new ChartPatternEngine();
        console.log('✅ Chart Pattern Engine iniciado');
        
        // Integrar con processTradeResult
        const originalProcess = MarketBridgeV27.processTradeResult.bind(MarketBridgeV27);
        MarketBridgeV27.processTradeResult = function(prediction) {
            originalProcess(prediction);
            // Actualizar inmediatamente el análisis de patrones
            if (window.chartPatternEngine && window.sequence) {
                window.chartPatternEngine.analyze(window.sequence);
            }
        };
    }
}, 1000);

console.log('✅ Parte 5/5 cargada: Integración Final V27');