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
// ==================== CHART PATTERN RECOGNITION ENGINE V27 - CORREGIDO ====================

class ChartPatternEngine {
    constructor(containerId = 'chart-pattern-monitor') {
        this.container = document.getElementById(containerId);
        this.canvas = null;
        this.ctx = null;
        this.priceData = [];
        this.detectedPatterns = [];
        this.patternHistory = [];
        this.lastAnalyzedLength = 0;
        this.lastSequence = [];
        this.currentView = 'IA'; // 'IA' o 'TU'
        this.isInitialized = false;
        
        // Crear contenedor si no existe
        if (!this.container) {
            this.container = this.createContainer();
        }
        
        // Esperar a que el DOM esté listo para inicializar
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            // Usar setTimeout para asegurar que el contenedor tenga dimensiones
            setTimeout(() => this.initialize(), 100);
        }
    }
    
    initialize() {
        if (this.isInitialized) return;
        
        this.initCanvas();
        this.setupPatternLibrary();
        this.initToggleButton();
        this.startAnalysisLoop();
        
        // Forzar primer análisis si hay datos disponibles
        setTimeout(() => {
            const seq = window.sequence || [];
            if (seq.length > 0) {
                console.log('[ChartPatternEngine] Primer análisis forzado:', seq.length, 'items');
                this.analyze(seq);
            }
        }, 500);
        
        this.isInitialized = true;
        console.log('✅ ChartPatternEngine inicializado correctamente');
    }
    
       
    initCanvas() {
        this.canvas = document.getElementById('chart-pattern-canvas');
        if (!this.canvas) {
            console.error('[ChartPatternEngine] Canvas no encontrado');
            return;
        }
        
        // Forzar tamaño del canvas con valores absolutos
        const container = this.canvas.parentElement;
        if (!container) {
            console.error('[ChartPatternEngine] Contenedor del canvas no encontrado');
            return;
        }
        
        // Asegurar que el contenedor tenga tamaño
        const rect = container.getBoundingClientRect();
        const width = Math.max(rect.width, 300); // Mínimo 300px
        const height = Math.max(rect.height, 250); // Mínimo 250px
        
        // Configurar canvas con dimensiones reales (considerando pixel ratio)
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.floor(width * dpr);
        this.canvas.height = Math.floor(height * dpr);
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            console.error('[ChartPatternEngine] No se pudo obtener contexto 2D');
            return;
        }
        
        this.ctx.scale(dpr, dpr);
        
        console.log('[ChartPatternEngine] Canvas inicializado:', width + 'x' + height, 'DPR:', dpr);
        
        // Dibujar fondo de prueba para verificar que funciona
        this.drawTestPattern();
    }
    
    drawTestPattern() {
        if (!this.ctx || !this.canvas) return;
        
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        // Fondo oscuro
        this.ctx.fillStyle = 'rgba(10, 10, 25, 0.8)';
        this.ctx.fillRect(0, 0, width, height);
        
        // Grid de referencia
        this.ctx.strokeStyle = 'rgba(0, 212, 255, 0.1)';
        this.ctx.lineWidth = 1;
        const gridSize = 30;
        
        for (let x = 0; x < width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }
        
        // Texto de espera
        this.ctx.fillStyle = '#00d4ff';
        this.ctx.font = '14px JetBrains Mono';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('🎯 Motor de Patrones Listo', width / 2, height / 2 - 20);
        this.ctx.fillStyle = '#888';
        this.ctx.font = '12px Inter';
        this.ctx.fillText('Esperando datos de secuencia...', width / 2, height / 2 + 10);
        
        console.log('[ChartPatternEngine] Patrón de test dibujado');
    }
    
    initToggleButton() {
        const toggleBtn = document.getElementById('toggle-view-btn');
        const label = document.getElementById('current-view-label');
        
        if (!toggleBtn) {
            console.warn('[ChartPatternEngine] Botón toggle no encontrado');
            return;
        }

        toggleBtn.addEventListener('click', () => {
            this.currentView = this.currentView === 'IA' ? 'TU' : 'IA';
            
            if (label) label.textContent = this.currentView;
            
            // Actualizar estilos del botón
            if (this.currentView === 'TU') {
                toggleBtn.style.background = 'rgba(0, 255, 170, 0.25)';
                toggleBtn.style.borderColor = '#00ffaa';
            } else {
                toggleBtn.style.background = 'rgba(0, 212, 255, 0.15)';
                toggleBtn.style.borderColor = '#00d4ff';
            }

            const seqToUse = this.currentView === 'TU' 
                ? (window.userManualSequence || []) 
                : (window.sequence || []);

            console.log(`[ChartPatternEngine] Cambiando a vista ${this.currentView}:`, {
                length: seqToUse.length,
                source: this.currentView === 'TU' ? 'userManualSequence' : 'sequence'
            });

            if (seqToUse.length >= 5) {
                this.analyze(seqToUse);
                this.flashCanvas();
            } else {
                this.showNoDataMessage(this.currentView);
            }
        });

        console.log('[ChartPatternEngine] Botón toggle inicializado');
    }
    
    showNoDataMessage(view) {
        const activeDiv = document.getElementById('active-pattern');
        if (activeDiv) {
            const sourceName = view === 'TU' ? 'trades manuales' : 'datos de IA';
            const currentCount = view === 'TU' 
                ? (window.userManualSequence?.length || 0) 
                : (window.sequence?.length || 0);
                
            activeDiv.innerHTML = `
                <div class="no-pattern" style="padding: 30px; text-align: center;">
                    <div style="font-size: 32px; margin-bottom: 10px;">⚠️</div>
                    <div style="font-size: 14px; color: #ff9f43; margin-bottom: 8px;">
                        Sin datos suficientes para vista ${view}
                    </div>
                    <div style="font-size: 12px; color: #666;">
                        Tienes ${currentCount} ${sourceName}. Necesitas mínimo 5.
                    </div>
                    <div style="font-size: 11px; color: #888; margin-top: 10px;">
                        Realiza algunas operaciones para generar datos.
                    </div>
                </div>
            `;
        }
        
        // Limpiar canvas y mostrar mensaje
        if (this.ctx && this.canvas) {
            const rect = this.canvas.parentElement.getBoundingClientRect();
            this.ctx.clearRect(0, 0, rect.width, rect.height);
            this.ctx.fillStyle = 'rgba(255, 159, 67, 0.1)';
            this.ctx.fillRect(0, 0, rect.width, rect.height);
            this.ctx.fillStyle = '#ff9f43';
            this.ctx.font = '14px JetBrains Mono';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`📊 Datos insuficientes (${view})`, rect.width / 2, rect.height / 2);
        }
    }
    
    flashCanvas() {
        if (!this.canvas) return;
        this.canvas.style.transition = 'opacity 0.15s ease';
        this.canvas.style.opacity = '0.3';
        setTimeout(() => {
            this.canvas.style.opacity = '1';
        }, 150);
    }
    

setupPatternLibrary() {
    // SOLO PATRONES TIER S y A - Máxima efectividad, mínimo ruido
    this.patterns = {
        // 🥇 TIER S - 75-78% éxito (Prioridad máxima)
        'BULL_FLAG': { 
            name: 'Bandera Alcista', 
            type: 'CONTINUACIÓN_ALCISTA',
            category: 'MOMENTUM',
            icon: '🏳️‍🌈', 
            minBars: 6, 
            priority: 1,
            regime: ['TREND_UP', 'STRONG_UP'],
            requires: (data) => this.hasStrongMomentum(data, 'UP'),
            detect: (data) => this.detectBullFlag(data),
            stats: { successRate: 0.78, avgMove: 0.20, direction: 'A' }, 
            color: '#00d4ff',
            bgColor: 'rgba(0,212,255,0.15)'
        },
        
        'HEAD_SHOULDERS': { 
            name: 'H-C-H', 
            type: 'REVERSIÓN_BAJISTA',
            category: 'CORE',
            icon: '🦈', 
            minBars: 12, 
            priority: 1,
            regime: ['TREND_UP', 'EXHAUSTION'],
            detect: (data) => this.detectHeadShoulders(data),
            stats: { successRate: 0.76, avgMove: 0.19, direction: 'B' }, 
            color: '#d63031',
            bgColor: 'rgba(214,48,49,0.15)'
        },
        
        'ASCENDING_TRIANGLE': { 
            name: 'Triángulo Ascendente', 
            type: 'CONTINUACIÓN_ALCISTA',
            category: 'CORE',
            icon: '▲', 
            minBars: 10, 
            priority: 1,
            regime: ['TREND_UP', 'RANGE'],
            detect: (data) => this.detectAscendingTriangle(data),
            stats: { successRate: 0.75, avgMove: 0.18, direction: 'A' }, 
            color: '#00b894',
            bgColor: 'rgba(0,184,148,0.15)'
        },
        
        // 🥈 TIER A - 72-74% éxito (Complementarios)
        'DOUBLE_TOP': { 
            name: 'Doble Techo', 
            type: 'REVERSIÓN_BAJISTA',
            category: 'CORE',
            icon: '📉', 
            minBars: 8, 
            priority: 2,
            regime: ['TREND_UP', 'RANGE', 'EXHAUSTION'],
            detect: (data) => this.detectDoubleTop(data),
            stats: { successRate: 0.74, avgMove: 0.16, direction: 'B' }, 
            color: '#e63946',
            bgColor: 'rgba(230,57,70,0.15)'
        },
        
        'DOUBLE_BOTTOM': { 
            name: 'Doble Suelo', 
            type: 'REVERSIÓN_ALCISTA',
            category: 'CORE',
            icon: '📈', 
            minBars: 8, 
            priority: 2,
            regime: ['TREND_DOWN', 'RANGE', 'RECOVERY'],
            detect: (data) => this.detectDoubleBottom(data),
            stats: { successRate: 0.72, avgMove: 0.15, direction: 'A' }, 
            color: '#2ecc71',
            bgColor: 'rgba(46,204,113,0.15)'
        },
        
        'FALLING_WEDGE': { 
            name: 'Cuña Descendente', 
            type: 'REVERSIÓN_ALCISTA',
            category: 'MOMENTUM',
            icon: '🔽⬆️', 
            minBars: 15, 
            priority: 2,
            regime: ['TREND_DOWN', 'EXHAUSTION'],
            detect: (data) => this.detectFallingWedge(data),
            stats: { successRate: 0.73, avgMove: 0.18, direction: 'A' }, 
            color: '#27ae60',
            bgColor: 'rgba(39,174,96,0.15)'
        }
    };
}

// ============ DETECTORES OPTIMIZADOS (6 patrones) ============

detectBullFlag(data) {
    if (data.length < 8) return { detected: false, confidence: 0 };
    
    // Polo: últimas 5 velas antes de la bandera
    const poleStart = Math.max(0, data.length - 10);
    const poleEnd = Math.max(0, data.length - 5);
    const pole = data.slice(poleStart, poleEnd);
    const flag = data.slice(-5);
    
    if (pole.length < 3 || flag.length < 3) return { detected: false, confidence: 0 };
    
    // Polo fuerte alcista (>5% en pocas velas)
    const poleMove = (pole[pole.length - 1].close - pole[0].close) / pole[0].close;
    if (poleMove < 0.05) return { detected: false, confidence: 0 };
    
    // Bandera: consolidación descendente o lateral estrecha
    const flagHigh = Math.max(...flag.map(d => d.high));
    const flagLow = Math.min(...flag.map(d => d.low));
    const flagRange = (flagHigh - flagLow) / flag[0].close;
    
    // Bandera debe ser descendente o neutral (corrección del polo)
    const flagTrend = flag[flag.length - 1].close - flag[0].close;
    
    const detected = flagRange < 0.04 && flagTrend <= 0.02;
    const confidence = detected ? Math.min(0.78, 0.65 + poleMove * 2) : 0;
    
    return { detected, confidence };
}

detectHeadShoulders(data) {
    if (data.length < 15) return { detected: false, confidence: 0 };
    
    const recent = data.slice(-20);
    const highs = recent.map((d, i) => ({ price: d.high, idx: i, close: d.close }));
    
    // Encontrar 3 tops significativos
    const tops = [];
    for (let i = 1; i < highs.length - 1; i++) {
        if (highs[i].price > highs[i-1].price && highs[i].price > highs[i+1].price) {
            tops.push(highs[i]);
        }
    }
    
    if (tops.length < 3) return { detected: false, confidence: 0 };
    
    // Ordenar por altura y tomar los 3 más altos
    const sortedTops = tops.sort((a, b) => b.price - a.price).slice(0, 3);
    const head = sortedTops[0];
    const shoulders = sortedTops.slice(1).sort((a, b) => a.idx - b.idx);
    
    // Validar estructura: izquierda < cabeza > derecha
    const leftShoulder = shoulders[0];
    const rightShoulder = shoulders[1];
    
    if (!leftShoulder || !rightShoulder) return { detected: false, confidence: 0 };
    
    // Cabeza debe ser significativamente más alta
    const headHigher = head.price > leftShoulder.price * 1.03 && head.price > rightShoulder.price * 1.03;
    
    // Hombros aproximadamente a la misma altura (±5%)
    const shouldersLevel = Math.abs(leftShoulder.price - rightShoulder.price) / leftShoulder.price < 0.05;
    
    // Cabeza centrada entre hombros
    const headCentered = head.idx > leftShoulder.idx && head.idx < rightShoulder.idx;
    
    // Línea del cuello: línea de tendencia entre los hombros
    const neckLineSlope = (rightShoulder.price - leftShoulder.price) / (rightShoulder.idx - leftShoulder.idx);
    const neckLineValid = Math.abs(neckLineSlope) / leftShoulder.price < 0.02; // Línea del cuello relativamente plana
    
    const detected = headHigher && shouldersLevel && headCentered && neckLineValid;
    
    // Confianza basada en simetría y claridad de la estructura
    const symmetry = 1 - Math.abs(leftShoulder.idx - (head.idx - leftShoulder.idx) - rightShoulder.idx) / 20;
    const clarity = (head.price - Math.max(leftShoulder.price, rightShoulder.price)) / head.price;
    const confidence = detected ? Math.min(0.76, 0.6 + symmetry * 0.1 + clarity * 5) : 0;
    
    return { detected, confidence };
}

detectAscendingTriangle(data) {
    if (data.length < 12) return { detected: false, confidence: 0 };
    
    const recent = data.slice(-15);
    const highs = recent.map(d => d.high);
    const lows = recent.map(d => d.low);
    
    // Resistencia horizontal (máximos similares)
    const resistance = Math.max(...highs);
    const highsNearResistance = highs.filter(h => h > resistance * 0.985).length;
    const flatTop = highsNearResistance >= 3;
    
    // Soporte ascendente (mínimos crecientes)
    const firstThird = lows.slice(0, 5);
    const lastThird = lows.slice(-5);
    const avgFirst = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
    const avgLast = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;
    const risingBottom = avgLast > avgFirst * 1.02;
    
    // Convergencia hacia el ápice
    const startRange = resistance - avgFirst;
    const endRange = resistance - avgLast;
    const converging = endRange < startRange * 0.7;
    
    // Volumen decreciente (simulado por rango de velas)
    const ranges = recent.map(d => d.high - d.low);
    const avgRangeFirst = ranges.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const avgRangeLast = ranges.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const contracting = avgRangeLast < avgRangeFirst * 0.8;
    
    const detected = flatTop && risingBottom && converging;
    const confidence = detected ? Math.min(0.75, 0.6 + (highsNearResistance * 0.03) + (contracting ? 0.05 : 0)) : 0;
    
    return { detected, confidence };
}

detectDoubleTop(data) {
    if (data.length < 12) return { detected: false, confidence: 0 };
    
    const recent = data.slice(-20);
    const highs = recent.map((d, i) => ({ price: d.high, idx: i }));
    
    // Encontrar dos máximos significativos
    const tops = [];
    for (let i = 1; i < highs.length - 1; i++) {
        if (highs[i].price > highs[i-1].price && highs[i].price > highs[i+1].price) {
            // Mínimo local significativo
            if (highs[i].price > Math.max(...recent.slice(0, i).map(d => d.high)) * 0.95) {
                tops.push(highs[i]);
            }
        }
    }
    
    if (tops.length < 2) return { detected: false, confidence: 0 };
    
    // Tomar los dos tops más altos y recientes
    const sortedTops = tops.sort((a, b) => b.price - a.price).slice(0, 2).sort((a, b) => a.idx - b.idx);
    const top1 = sortedTops[0];
    const top2 = sortedTops[1];
    
    // Similitud de altura (±4%)
    const heightSimilarity = 1 - Math.abs(top1.price - top2.price) / top1.price;
    const similarHeight = heightSimilarity > 0.96;
    
    // Separación mínima entre tops (evitar velas adyacentes)
    const separated = top2.idx - top1.idx > 3;
    
    // Valley entre tops (pullback significativo)
    const betweenTops = recent.slice(top1.idx, top2.idx);
    const valley = Math.min(...betweenTops.map(d => d.low));
    const valleyDepth = (top1.price - valley) / top1.price;
    const validValley = valleyDepth > 0.03;
    
    // Segundo top rechazado (cierre por debajo del máximo)
    const secondTopRejection = top2.price > recent[top2.idx].close;
    
    const detected = similarHeight && separated && validValley && secondTopRejection;
    const confidence = detected ? Math.min(0.74, 0.6 + heightSimilarity * 0.1 + Math.min(valleyDepth * 3, 0.04)) : 0;
    
    return { detected, confidence };
}

detectDoubleBottom(data) {
    if (data.length < 12) return { detected: false, confidence: 0 };
    
    const recent = data.slice(-20);
    const lows = recent.map((d, i) => ({ price: d.low, idx: i }));
    
    // Encontrar dos mínimos significativos
    const bottoms = [];
    for (let i = 1; i < lows.length - 1; i++) {
        if (lows[i].price < lows[i-1].price && lows[i].price < lows[i+1].price) {
            // Mínimo local significativo
            if (lows[i].price < Math.min(...recent.slice(0, i).map(d => d.low)) * 1.05) {
                bottoms.push(lows[i]);
            }
        }
    }
    
    if (bottoms.length < 2) return { detected: false, confidence: 0 };
    
    // Tomar los dos fondos más bajos y recientes
    const sortedBottoms = bottoms.sort((a, b) => a.price - b.price).slice(0, 2).sort((a, b) => a.idx - b.idx);
    const bottom1 = sortedBottoms[0];
    const bottom2 = sortedBottoms[1];
    
    // Similitud de profundidad (±4%)
    const depthSimilarity = 1 - Math.abs(bottom1.price - bottom2.price) / bottom1.price;
    const similarDepth = depthSimilarity > 0.96;
    
    // Separación mínima
    const separated = bottom2.idx - bottom1.idx > 3;
    
    // Peak entre fondos (rebote significativo)
    const betweenBottoms = recent.slice(bottom1.idx, bottom2.idx);
    const peak = Math.max(...betweenBottoms.map(d => d.high));
    const peakHeight = (peak - bottom1.price) / bottom1.price;
    const validPeak = peakHeight > 0.03;
    
    // Segundo fondo rechazado (cierre por encima del mínimo)
    const secondBottomRejection = bottom2.price < recent[bottom2.idx].close;
    
    const detected = similarDepth && separated && validPeak && secondBottomRejection;
    const confidence = detected ? Math.min(0.72, 0.6 + depthSimilarity * 0.08 + Math.min(peakHeight * 3, 0.04)) : 0;
    
    return { detected, confidence };
}

detectFallingWedge(data) {
    if (data.length < 18) return { detected: false, confidence: 0 };
    
    const recent = data.slice(-20);
    const highs = recent.map(d => d.high);
    const lows = recent.map(d => d.low);
    
    // Tendencia descendente previa
    const firstPrice = recent[0].close;
    const lastPrice = recent[recent.length - 1].close;
    const downtrend = lastPrice < firstPrice * 0.95;
    
    if (!downtrend) return { detected: false, confidence: 0 };
    
    // Línea de resistencia descendente (máximos decrecientes)
    const earlyHighs = highs.slice(0, 7);
    const lateHighs = highs.slice(-7);
    const avgEarlyHigh = earlyHighs.reduce((a, b) => a + b, 0) / earlyHighs.length;
    const avgLateHigh = lateHighs.reduce((a, b) => a + b, 0) / lateHighs.length;
    const fallingResistance = avgLateHigh < avgEarlyHigh * 0.98;
    
    // Línea de soporte descendente pero menos pronunciada (convergencia)
    const earlyLows = lows.slice(0, 7);
    const lateLows = lows.slice(-7);
    const avgEarlyLow = earlyLows.reduce((a, b) => a + b, 0) / earlyLows.length;
    const avgLateLow = lateLows.reduce((a, b) => a + b, 0) / lateLows.length;
    const fallingSupport = avgLateLow < avgEarlyLow;
    
    // Convergencia: resistencia cae más rápido que soporte
    const highSlope = (avgLateHigh - avgEarlyHigh) / avgEarlyHigh;
    const lowSlope = (avgLateLow - avgEarlyLow) / avgEarlyLow;
    const converging = Math.abs(highSlope) > Math.abs(lowSlope) * 1.2;
    
    // Rango comprimiéndose
    const earlyRange = avgEarlyHigh - avgEarlyLow;
    const lateRange = avgLateHigh - avgLateLow;
    const compressing = lateRange < earlyRange * 0.7;
    
    // Cierre cerca del máximo reciente (presión compradora)
    const nearHigh = lastPrice > avgLateHigh * 0.99;
    
    const detected = fallingResistance && fallingSupport && converging && compressing;
    const confidence = detected ? Math.min(0.73, 0.6 + (compressing ? 0.08 : 0) + (nearHigh ? 0.05 : 0)) : 0;
    
    return { detected, confidence };
}

// ============ HELPERS ============

hasStrongMomentum(data, direction) {
    if (data.length < 12) return false;
    
    const recent = data.slice(-12);
    const returns = [];
    
    for (let i = 1; i < recent.length; i++) {
        returns.push((recent[i].close - recent[i-1].close) / recent[i-1].close);
    }
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const totalMove = (recent[recent.length - 1].close - recent[0].close) / recent[0].close;
    
    // Momentum fuerte: movimiento consistente en dirección
    if (direction === 'UP') {
        return avgReturn > 0.002 && totalMove > 0.04;
    }
    if (direction === 'DOWN') {
        return avgReturn < -0.002 && totalMove < -0.04;
    }
    
    return false;
}

detectRegime(data) {
    if (data.length < 15) return 'RANGE';
    
    const recent = data.slice(-20);
    const prices = recent.map(d => d.close);
    
    const first = prices[0];
    const last = prices[prices.length - 1];
    const change = (last - first) / first;
    
    // Calcular volatilidad (desviación estándar de retornos)
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    
    // Determinar régimen
    if (change > 0.08 && volatility > 0.015) return 'STRONG_UP';
    if (change > 0.04) return 'TREND_UP';
    if (change < -0.08 && volatility > 0.015) return 'STRONG_DOWN';
    if (change < -0.04) return 'TREND_DOWN';
    if (change > 0.02 && volatility < 0.008) return 'EXHAUSTION';
    if (change < -0.02 && volatility < 0.008) return 'EXHAUSTION';
    if (volatility < 0.01) return 'CONSOLIDATION';
    
    return 'RANGE';
}


    // ============ CONVERSIÓN CORREGIDA ============
    convertSequenceToOHLC(sequence) {
        if (!sequence || sequence.length === 0) {
            console.warn('[ChartPatternEngine] Secuencia vacía');
            return [];
        }
        
        // Validar formato de datos
        const firstItem = sequence[0];
        if (!firstItem || (typeof firstItem.val === 'undefined' && typeof firstItem !== 'string')) {
            console.error('[ChartPatternEngine] Formato de secuencia inválido:', firstItem);
            return [];
        }
        
        let basePrice = 100;
        const ohlcData = [];
        
        for (let i = 0; i < sequence.length; i++) {
            const item = sequence[i];
            
            // Soportar tanto objetos {val: 'A'} como strings 'A'
            const val = typeof item === 'string' ? item : item.val;
            const isA = val === 'A';
            
            if (!isA && val !== 'B') {
                console.warn('[ChartPatternEngine] Valor inválido en secuencia:', val);
                continue;
            }
            
            const vol = 0.02;
            const open = basePrice;
            const close = isA ? basePrice * (1 + vol) : basePrice * (1 - vol);
            const high = Math.max(open, close) * 1.005;
            const low = Math.min(open, close) * 0.995;
            
            basePrice = close;
            
            ohlcData.push({
                open,
                high,
                low,
                close,
                val,
                timestamp: item.timestamp || Date.now() + (i * 1000)
            });
        }
        
        console.log('[ChartPatternEngine] OHLC generado:', ohlcData.length, 'barras');
        return ohlcData;
    }
    
    analyze(sequence) {
        console.log('[ChartPatternEngine] Analizando secuencia:', sequence.length, 'items');
        
        if (!Array.isArray(sequence) || sequence.length === 0) {
            console.warn('[ChartPatternEngine] Secuencia inválida');
            this.showNoDataMessage(this.currentView);
            return;
        }
        
        this.lastSequence = [...sequence];
        this.priceData = this.convertSequenceToOHLC(sequence);
        
        if (this.priceData.length < 5) {
            console.warn('[ChartPatternEngine] Datos insuficientes tras conversión:', this.priceData.length);
            this.showNoDataMessage(this.currentView);
            return;
        }
        
        // Detectar patrones
        const detected = [];
        for (const [key, pattern] of Object.entries(this.patterns)) {
            if (this.priceData.length < pattern.minBars) continue;
            
            try {
                const result = pattern.detect(this.priceData);
                if (result.detected && result.confidence > 0.6) {
                    detected.push({ key, ...pattern, ...result, timestamp: Date.now() });
                }
            } catch (e) {
                console.error('[ChartPatternEngine] Error detectando patrón', key, e);
            }
        }
        
        detected.sort((a, b) => b.confidence - a.confidence);
        this.detectedPatterns = detected.slice(0, 2);
        
        console.log('[ChartPatternEngine] Patrones detectados:', this.detectedPatterns.map(p => p.name));
        
        // Dibujar y actualizar UI
        this.draw();
        this.updateUI();
        
        // Alerta si hay patrón fuerte
        if (detected.length > 0 && detected[0].confidence > 0.75) {
            this.triggerAlert(detected[0]);
        }
    }
    
    forceRedraw() {
        console.log('[ChartPatternEngine] Redibujo forzado');
        if (this.lastSequence && this.lastSequence.length > 0) {
            this.analyze(this.lastSequence);
            this.flashCanvas();
        } else if (window.sequence && window.sequence.length > 0) {
            this.analyze(window.sequence);
        }
    }
    
    draw() {
        if (!this.ctx || !this.canvas) {
            console.error('[ChartPatternEngine] No hay contexto o canvas para dibujar');
            return;
        }
        
        if (this.priceData.length === 0) {
            console.warn('[ChartPatternEngine] No hay datos de precio para dibujar');
            return;
        }
        
        const ctx = this.ctx;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        // Limpiar canvas
        ctx.clearRect(0, 0, width, height);
        
        // Fondo
        ctx.fillStyle = 'rgba(10, 10, 25, 0.3)';
        ctx.fillRect(0, 0, width, height);
        
        // Calcular rango de precios
        const prices = this.priceData.flatMap(d => [d.high, d.low]);
        const minPrice = Math.min(...prices) * 0.995;
        const maxPrice = Math.max(...prices) * 1.005;
        const range = maxPrice - minPrice;
        
        if (range === 0 || !isFinite(range)) {
            console.warn('[ChartPatternEngine] Rango de precios inválido');
            return;
        }
        
        const padding = 40;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;
        
        // Dibujar grid
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.08)';
        ctx.lineWidth = 1;
        const gridLines = 6;
        
        for (let i = 0; i <= gridLines; i++) {
            const y = padding + (chartHeight / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.stroke();
            
            // Etiqueta de precio
            const price = maxPrice - (range / gridLines) * i;
            ctx.fillStyle = '#666';
            ctx.font = '10px JetBrains Mono';
            ctx.textAlign = 'right';
            ctx.fillText(price.toFixed(2), padding - 5, y + 3);
        }
        
        // Dibujar velas
        const candleWidth = Math.max(4, (chartWidth / this.priceData.length) * 0.7);
        const spacing = chartWidth / this.priceData.length;
        
        this.priceData.forEach((d, i) => {
            const x = padding + i * spacing + spacing / 2;
            
            // Calcular Ys
            const yOpen = padding + chartHeight - ((d.open - minPrice) / range) * chartHeight;
            const yClose = padding + chartHeight - ((d.close - minPrice) / range) * chartHeight;
            const yHigh = padding + chartHeight - ((d.high - minPrice) / range) * chartHeight;
            const yLow = padding + chartHeight - ((d.low - minPrice) / range) * chartHeight;
            
            const color = d.val === 'A' ? '#00ffaa' : '#ff4d82';
            
            // Sombra (high-low)
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.moveTo(x, yHigh);
            ctx.lineTo(x, yLow);
            ctx.stroke();
            ctx.globalAlpha = 1;
            
            // Cuerpo (open-close)
            ctx.fillStyle = color;
            const bodyTop = Math.min(yOpen, yClose);
            const bodyHeight = Math.abs(yClose - yOpen);
            ctx.fillRect(x - candleWidth/2, bodyTop, candleWidth, Math.max(bodyHeight, 2));
            
            // Borde brillante
            ctx.strokeStyle = color;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x - candleWidth/2, bodyTop, candleWidth, Math.max(bodyHeight, 2));
        });
        
        // Dibujar línea de tendencia si hay patrón detectado
        if (this.detectedPatterns.length > 0) {
            this.drawPatternOverlay(ctx, width, height, padding, minPrice, range, chartHeight);
        }
        
        // Información en el canvas
        ctx.fillStyle = '#00d4ff';
        ctx.font = 'bold 12px Orbitron';
        ctx.textAlign = 'left';
        ctx.fillText(`${this.priceData.length} VELAS | ${this.currentView}`, padding, 20);
        
        console.log('[ChartPatternEngine] Canvas dibujado con', this.priceData.length, 'velas');
    }
    
    drawPatternOverlay(ctx, width, height, padding, minPrice, range, chartHeight) {
        const top = this.detectedPatterns[0];
        
        ctx.strokeStyle = top.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.globalAlpha = 0.8;
        
        const lastIdx = this.priceData.length - 1;
        const spacing = (width - padding * 2) / this.priceData.length;
        const x1 = padding + lastIdx * spacing + spacing / 2;
        
        const lastClose = this.priceData[lastIdx].close;
        const targetPrice = lastClose * (1 + (top.stats.avgMove * (top.stats.direction === 'A' ? 1 : -1)));
        
        const y1 = padding + chartHeight - ((lastClose - minPrice) / range) * chartHeight;
        const yTarget = padding + chartHeight - ((targetPrice - minPrice) / range) * chartHeight;
        
        // Línea de proyección
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + 60, yTarget);
        ctx.stroke();
        
        // Etiqueta del patrón
        ctx.fillStyle = top.color;
        ctx.font = 'bold 11px JetBrains Mono';
        ctx.textAlign = 'left';
        ctx.setLineDash([]);
        ctx.fillText(`${top.icon} ${top.name}`, x1 + 65, yTarget);
        
        ctx.globalAlpha = 1;
    }
    
    updateUI() {
        const activeDiv = document.getElementById('active-pattern');
        const matchesDiv = document.getElementById('pattern-matches');
        
        if (!activeDiv) {
            console.error('[ChartPatternEngine] Elemento active-pattern no encontrado');
            return;
        }

        if (this.detectedPatterns.length === 0) {
            activeDiv.innerHTML = `
                <div class="no-pattern" style="padding: 30px; text-align: center;">
                    <div style="font-size: 32px; margin-bottom: 10px;">🔍</div>
                    <div style="font-size: 14px; color: #888; margin-bottom: 5px;">Sin figuras detectadas</div>
                    <div style="font-size: 11px; color: #666;">Analizando ${this.priceData.length} velas...</div>
                </div>
            `;
            if (matchesDiv) matchesDiv.innerHTML = '';
            return;
        }

        const top = this.detectedPatterns[0];
        const successRate = (top?.stats?.successRate ?? 0.5) * 100;
        const confidence = (top?.confidence ?? 0) * 100;
        const avgMove = (top?.stats?.avgMove ?? 0) * 100;
        const direction = top?.stats?.direction ?? 'NEUTRAL';
        
        activeDiv.innerHTML = `
            <div class="pattern-detected" 
                 style="padding: 20px; 
                        border-radius: 12px; 
                        background: linear-gradient(135deg, rgba(0,0,0,0.4), rgba(0,0,0,0.2)); 
                        border-left: 4px solid ${top.color};
                        box-shadow: 0 4px 15px ${top.color}20;">
                
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                    <div style="font-size: 36px;">${top.icon}</div>
                    <div>
                        <div style="font-size: 16px; font-weight: 700; color: ${top.color}; margin-bottom: 2px;">
                            ${top.name}
                        </div>
                        <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px;">
                            ${top.type}
                        </div>
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #888; margin-bottom: 5px;">
                        <span>Confianza del patrón</span>
                        <span style="color: ${top.color}; font-weight: 600;">${confidence.toFixed(0)}%</span>
                    </div>
                    <div style="background: rgba(100,100,100,0.2); height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="width: ${confidence}%; 
                                    height: 100%; 
                                    background: linear-gradient(90deg, ${top.color}, ${top.color}80);
                                    transition: width 0.5s ease;
                                    border-radius: 4px;">
                        </div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 12px;">
                    <div style="text-align: center; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px;">
                        <div style="color: #666; font-size: 10px; margin-bottom: 4px;">Probabilidad</div>
                        <div style="color: ${direction === 'A' ? '#00ffaa' : '#ff4d82'}; font-weight: 700; font-size: 14px;">
                            ${successRate.toFixed(0)}%
                        </div>
                    </div>
                    <div style="text-align: center; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px;">
                        <div style="color: #666; font-size: 10px; margin-bottom: 4px;">Objetivo</div>
                        <div style="color: ${top.color}; font-weight: 700; font-size: 14px;">
                            ${avgMove.toFixed(1)}%
                        </div>
                    </div>
                    <div style="text-align: center; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px;">
                        <div style="color: #666; font-size: 10px; margin-bottom: 4px;">Dirección</div>
                        <div style="color: ${top.color}; font-weight: 700; font-size: 14px;">
                            ${direction === 'A' ? 'ALCISTA' : direction === 'B' ? 'BAJISTA' : 'NEUTRAL'}
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (matchesDiv && this.detectedPatterns.length > 1) {
            matchesDiv.innerHTML = this.detectedPatterns.slice(1).map(p => {
                const pConf = (p?.confidence ?? 0) * 100;
                const pDir = p?.stats?.direction === 'A' ? 'bullish' : 'bearish';
                return `
                    <div class="match-item" 
                         style="display: flex; 
                                justify-content: space-between; 
                                align-items: center; 
                                padding: 12px; 
                                margin: 8px 0; 
                                background: rgba(0,0,0,0.25); 
                                border-radius: 8px; 
                                border-left: 3px solid ${p.color};
                                transition: all 0.2s ease;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 20px;">${p.icon}</span>
                            <div>
                                <div style="font-size: 12px; color: #ccc; font-weight: 600;">${p.name}</div>
                                <div style="font-size: 10px; color: #666;">${p.type}</div>
                            </div>
                        </div>
                        <span style="font-size: 12px; color: ${p.color}; font-weight: 700; background: ${p.color}20; padding: 4px 8px; border-radius: 4px;">
                            ${pConf.toFixed(0)}%
                        </span>
                    </div>
                `;
            }).join('');
        } else if (matchesDiv) {
            matchesDiv.innerHTML = '';
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
        // Loop principal de análisis
        setInterval(() => {
            const currentSeq = this.currentView === 'TU' 
                ? (window.userManualSequence || [])
                : (window.sequence || []);
            
            if (currentSeq && currentSeq.length !== this.lastAnalyzedLength && currentSeq.length >= 5) {
                this.analyze(currentSeq);
                this.lastAnalyzedLength = currentSeq.length;
            }
        }, 1500);
        
        // Redibujar en resize de ventana
        window.addEventListener('resize', () => {
            if (this.canvas && this.container) {
                // Reinicializar canvas con nuevas dimensiones
                this.initCanvas();
                if (this.lastSequence.length > 0) {
                    this.draw();
                }
            }
        });
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

// ==================== INTEGRACIÓN CORREGIDA ====================

// Inicializar cuando el DOM esté listo
function initChartPatternEngine() {
    console.log('[ChartPatternEngine] Preparando inicialización...');
    
    // Asegurar que exista userManualSequence
    if (!window.userManualSequence) {
        window.userManualSequence = [];
    }
    
    // Crear instancia global
    window.chartPatternEngine = new ChartPatternEngine();
    
    // Integrar con processTradeResult
    if (window.MarketBridgeV27) {
        const originalProcess = window.MarketBridgeV27.processTradeResult.bind(window.MarketBridgeV27);
        
        window.MarketBridgeV27.processTradeResult = function(prediction) {
            // Guardar en secuencia manual ANTES de procesar
            if (prediction && (prediction === 'A' || prediction === 'B')) {
                if (!window.userManualSequence) window.userManualSequence = [];
                
                window.userManualSequence.push({
                    val: prediction,
                    prediction: prediction,
                    timestamp: Date.now()
                });
                
                // Mantener máximo 40 items
                if (window.userManualSequence.length > 40) {
                    window.userManualSequence.shift();
                }
                
                console.log('[ManualSequence] Agregado:', prediction, 'Total:', window.userManualSequence.length);
            }
            
            // Llamar proceso original
            originalProcess(prediction);
            
            // Actualizar patrón si estamos en vista IA
            if (window.chartPatternEngine && window.sequence) {
                const isUserView = window.chartPatternEngine.currentView === 'TU';
                if (!isUserView && window.sequence.length >= 5) {
                    window.chartPatternEngine.analyze(window.sequence);
                }
            }
        };
        
        console.log('✅ ProcessTradeResult integrado con ChartPatternEngine');
    }
}

// Inicializar después de que todo cargue


// Agrega al final de market_5-5.js o en consola:
window.debugChartPattern = () => {
    const engine = window.chartPatternEngine;
    console.log('=== ChartPattern Debug ===');
    console.log('Engine exists:', !!engine);
    console.log('Last sequence:', engine?.lastSequence?.length);
    console.log('Price data:', engine?.priceData?.length);
    console.log('Detected patterns:', engine?.detectedPatterns);
    console.log('Canvas:', document.getElementById('chart-pattern-canvas'));
    console.log('userManualSequence:', window.userManualSequence?.length);
    console.log('sequence (IA):', window.sequence?.length);
};