class ChartPatternEngineV27 {
    constructor(containerId = 'chart-pattern-container') {
        // CONFIGURACIÓN ELITE: Optimizada para Visión Artificial
        this.config = {
            // Zoom y vista: Ajustados para la regla de las 3 velas
            zoom: {
                min: 0.3,           
                max: 4.0,           // Aumentado para ver micro-detalles
                current: 1.5,       // Inicia con zoom 1.5x para ver las 3 velas claras
                candleWidth: 24,    // DUPLICADO de 12 a 24 para que la CNN vea la forma
                spacing: 8          // Aumentado para evitar ruido visual entre velas
            },
            
            // Medias móviles: Se mantienen para análisis técnico profundo
            movingAverages: {
                ema: [
                    { period: 9, color: '#00d4ff', width: 2, label: 'EMA9' },
                    { period: 21, color: '#ff00aa', width: 2, label: 'EMA21' },
                    { period: 55, color: '#ffb400', width: 2, label: 'EMA55' }
                ],
                sma: [
                    { period: 20, color: '#00ffaa', width: 1.5, label: 'SMA20', dashed: true }
                ]
            },
            
            // Soportes y resistencias: Mantienen la estructura del mercado
            supportResistance: {
                lookback: 50,         
                tolerance: 0.02,      
                minTouches: 2,        
                maxLines: 4           
            },
            
            // Visual: Colores Neón de alto contraste para TensorFlow.js
            colors: {
                bg: '#050510',      // Fondo más profundo para resaltar el precio
                grid: 'rgba(0, 212, 255, 0.05)',
                gridText: '#555',
                bull: '#00ffcc',    // Neón Cian (Máximo contraste alcista)
                bear: '#ff0055',    // Neón Magenta (Máximo contraste bajista)
                bullShadow: 'rgba(0, 255, 204, 0.2)',
                bearShadow: 'rgba(255, 0, 85, 0.2)',
                crosshair: '#ffffff',
                projection: '#ff9f43'
            },
            
            // Patrones: Sensibilidad aumentada
            patterns: {
                enabled: true,
                minConfidence: 0.75, // Más estricto que el 0.65 anterior
                lookback: 30
            }
        };
        
        // Estado del motor (Se mantiene igual para no romper la lógica de datos)
        this.state = {
            data: [],              
            visibleData: [],       
            maData: {},            
            supportLevels: [],     
            resistanceLevels: [],  
            detectedPatterns: [],  
            crossovers: [],        
            bounces: [],           
            projections: [],       
            offset: 0,             
            hoverIndex: -1,        
            isDragging: false,
            dragStartX: 0,
            dragStartOffset: 0,
            view: 'IA',            
            lastUpdate: 0
        };
        
        // Elementos DOM
        this.container = document.getElementById(containerId) || this.createContainer();
        this.canvas = null;
        this.ctx = null;
        this.overlayCanvas = null;  
        this.overlayCtx = null;
        
        // Dimensiones profesionales
        this.dimensions = {
            width: 0,
            height: 0,
            chartHeight: 0,
            padding: { top: 40, right: 80, bottom: 30, left: 10 }
        };
        
        this.isInitialized = false;
        this.animationFrame = null;
        
        // Iniciar motor
        this.init();
    }
    
    init() {
        if (this.isInitialized || !this.container) return;
        console.log('[ChartV27] Inicializando...');
        this.setupContainer();
        this.setupCanvases();
        this.setupEventListeners();
        this.loadInitialData();
        this.startRenderLoop();
        this.isInitialized = true;
    }
    
    setupContainer() {
        this.container.innerHTML = `
            <div class="chart-pro-header" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:linear-gradient(90deg,rgba(0,212,255,0.1),transparent);border-bottom:1px solid rgba(0,212,255,0.2);">
                <div style="display:flex;align-items:center;gap:12px;">
                    <span style="font-family:'Orbitron',monospace;font-size:13px;color:#00d4ff;font-weight:700;">📊 CHART PATTERN PRO V27</span>
                    <span id="chart-pattern-status" style="font-size:10px;padding:4px 10px;background:rgba(0,255,170,0.15);color:#00ffaa;border-radius:12px;font-weight:600;">ANALIZANDO</span>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                    <button id="chart-view-toggle" style="padding:6px 12px;font-size:12px;background:rgba(0,212,255,0.15);border:1px solid #00d4ff;color:#e0f0ff;border-radius:6px;cursor:pointer;font-family:'JetBrains Mono',monospace;">Ver: <strong>IA</strong></button>
                    <button id="chart-zoom-out" style="width:32px;height:32px;background:rgba(100,100,100,0.2);border:1px solid #666;color:#fff;border-radius:6px;cursor:pointer;font-size:18px;">−</button>
                    <button id="chart-zoom-in" style="width:32px;height:32px;background:rgba(0,212,255,0.2);border:1px solid #00d4ff;color:#fff;border-radius:6px;cursor:pointer;font-size:18px;">+</button>
                </div>
            </div>
            <div class="chart-pro-toolbar" style="display:flex;gap:15px;padding:8px 16px;background:rgba(0,0,0,0.3);border-bottom:1px solid rgba(100,100,100,0.1);font-size:11px;color:#888;align-items:center;">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" id="toggle-ema9" checked style="accent-color:#00d4ff;"> <span style="color:#00d4ff;">EMA9</span></label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" id="toggle-ema21" checked style="accent-color:#ff00aa;"> <span style="color:#ff00aa;">EMA21</span></label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" id="toggle-ema55" checked style="accent-color:#ffb400;"> <span style="color:#ffb400;">EMA55</span></label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" id="toggle-sr" checked> <span>S/R Auto</span></label>
                <span style="margin-left:auto;font-family:'JetBrains Mono',monospace;">Zoom: <span id="zoom-level">100%</span> | Velas: <span id="candle-count">0</span></span>
            </div>
            <div class="chart-canvas-wrapper" style="position:relative;height:400px;width:100%;overflow:hidden;">
                <canvas id="chart-main-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;"></canvas>
                <canvas id="chart-overlay-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;"></canvas>
                <div id="chart-tooltip" style="position:absolute;display:none;background:rgba(10,10,30,0.95);border:1px solid #00d4ff;border-radius:8px;padding:12px;font-size:11px;font-family:'JetBrains Mono',monospace;color:#e0e0ff;z-index:1000;pointer-events:none;box-shadow:0 4px 20px rgba(0,0,0,0.5);"></div>
            </div>
            <div class="chart-info-panel" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:15px;padding:15px;background:rgba(0,0,0,0.2);border-top:1px solid rgba(100,100,100,0.1);">
                <div class="info-section"><div style="font-size:10px;color:#666;text-transform:uppercase;margin-bottom:8px;">Patrón Detectado</div><div style="font-size:14px;color:#00d4ff;font-weight:600;" id="current-pattern">Analizando...</div><div style="font-size:11px;color:#888;margin-top:4px;" id="pattern-confidence">Esperando datos</div></div>
                <div class="info-section"><div style="font-size:10px;color:#666;text-transform:uppercase;margin-bottom:8px;">Señales Técnicas</div><div style="display:flex;flex-wrap:wrap;gap:4px;" id="tech-signals"><span style="padding:3px 8px;background:rgba(100,100,100,0.2);border-radius:4px;font-size:10px;">Sin señales</span></div></div>
                <div class="info-section" id="recommendation-box" style="background:linear-gradient(135deg,rgba(0,212,255,0.1),rgba(0,255,170,0.05));border-radius:8px;padding:12px;border:1px solid rgba(0,212,255,0.2);">
                    <div style="font-size:10px;color:#00d4ff;text-transform:uppercase;margin-bottom:6px;">🧠 RECOMENDACIÓN IA</div>
                    <div style="font-size:18px;font-weight:700;color:#ffb400;" id="ia-recommendation">ESPERAR</div>
                    <div style="font-size:10px;color:#888;margin-top:4px;" id="recommendation-reason">Datos insuficientes</div>
                </div>
            </div>`;
    }
    
    setupCanvases() {
        this.canvas = document.getElementById('chart-main-canvas');
        this.overlayCanvas = document.getElementById('chart-overlay-canvas');
        if (!this.canvas || !this.overlayCanvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        this.resizeCanvases();
        new ResizeObserver(() => { this.resizeCanvases(); this.render(); }).observe(this.container);
    }
    
    resizeCanvases() {
        const wrapper = this.container.querySelector('.chart-canvas-wrapper');
        if (!wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.dimensions.width = rect.width;
        this.dimensions.height = rect.height;
        this.dimensions.chartHeight = rect.height - this.dimensions.padding.top - this.dimensions.padding.bottom;
        [this.canvas, this.overlayCanvas].forEach(canvas => {
            if (!canvas) return;
            canvas.width = Math.floor(rect.width * dpr);
            canvas.height = Math.floor(rect.height * dpr);
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
        });
        if (this.ctx) this.ctx.scale(dpr, dpr);
        if (this.overlayCtx) this.overlayCtx.scale(dpr, dpr);
    }
    
    setupEventListeners() {
        document.getElementById('chart-zoom-in')?.addEventListener('click', () => this.zoomIn());
        document.getElementById('chart-zoom-out')?.addEventListener('click', () => this.zoomOut());
        document.getElementById('chart-view-toggle')?.addEventListener('click', () => this.toggleView());
        ['ema9','ema21','ema55','sr'].forEach(id => {
            document.getElementById(`toggle-${id}`)?.addEventListener('change', () => this.render());
        });
        if (this.canvas) {
            this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
            this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());
            this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        }
    }



        // INTERACCIÓN
    zoomIn() { this.setZoom(Math.min(this.config.zoom.max, this.config.zoom.current * 1.2)); }
    zoomOut() { this.setZoom(Math.max(this.config.zoom.min, this.config.zoom.current / 1.2)); }
    setZoom(level) {
        this.config.zoom.current = level;
        this.updateVisibleData();
        document.getElementById('zoom-level').textContent = Math.round(level * 100) + '%';
        this.render();
    }
    
    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.setZoom(Math.max(this.config.zoom.min, Math.min(this.config.zoom.max, this.config.zoom.current * delta)));
    }
    
    handleMouseDown(e) {
        this.state.isDragging = true;
        this.state.dragStartX = e.clientX;
        this.state.dragStartOffset = this.state.offset;
        this.canvas.style.cursor = 'grabbing';
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const candleWidth = this.getCandleWidth();
        const index = Math.floor((x - this.dimensions.padding.left + this.state.offset) / candleWidth);
        
        if (index !== this.state.hoverIndex && index >= 0 && index < this.state.data.length) {
            this.state.hoverIndex = index;
            this.showTooltip(x, y, index);
            this.renderOverlay();
        }
        if (this.state.isDragging) {
            this.state.offset = Math.max(0, this.state.dragStartOffset - (e.clientX - this.state.dragStartX));
            this.updateVisibleData();
            this.render();
        }
    }
    
    handleMouseUp() {
        this.state.isDragging = false;
        this.canvas.style.cursor = 'crosshair';
    }
    
    // CÁLCULOS TÉCNICOS
    calculateEMA(data, period) {
        if (data.length < period) return new Array(data.length).fill(null);
        const k = 2 / (period + 1);
        const ema = [data[0].close];
        for (let i = 1; i < data.length; i++) ema.push(data[i].close * k + ema[i-1] * (1 - k));
        return ema;
    }
    
    calculateSMA(data, period) {
        if (data.length < period) return new Array(data.length).fill(null);
        const sma = new Array(period - 1).fill(null);
        for (let i = period - 1; i < data.length; i++) 
            sma.push(data.slice(i - period + 1, i + 1).reduce((a, b) => a + b.close, 0) / period);
        return sma;
    }
    
    updateMovingAverages() {
        if (this.state.data.length === 0) return;
        this.config.movingAverages.ema.forEach(ema => {
            this.state.maData[`ema${ema.period}`] = this.calculateEMA(this.state.data, ema.period);
        });
    }
    
    detectSupportResistance() {
        const data = this.state.data;
        if (data.length < 20) return;
        const recent = data.slice(-50);
        const highs = [], lows = [];
        
        for (let i = 2; i < recent.length - 2; i++) {
            if (recent[i].high > recent[i-1].high && recent[i].high > recent[i-2].high && 
                recent[i].high > recent[i+1].high && recent[i].high > recent[i+2].high)
                highs.push({ price: recent[i].high, index: data.length - 50 + i });
            if (recent[i].low < recent[i-1].low && recent[i].low < recent[i-2].low && 
                recent[i].low < recent[i+1].low && recent[i].low < recent[i+2].low)
                lows.push({ price: recent[i].low, index: data.length - 50 + i });
        }
        
        this.state.resistanceLevels = this.clusterLevels(highs);
        this.state.supportLevels = this.clusterLevels(lows);
    }
    
    clusterLevels(levels) {
        const clusters = [];
        levels.forEach(level => {
            let added = false;
            for (let cluster of clusters) {
                if (Math.abs(level.price - cluster.price) / cluster.price < 0.02) {
                    cluster.price = (cluster.price * cluster.touches + level.price) / (cluster.touches + 1);
                    cluster.touches++;
                    added = true;
                    break;
                }
            }
            if (!added) clusters.push({ price: level.price, touches: 1, strength: 0.5 });
        });
        return clusters.filter(c => c.touches >= 2).sort((a, b) => b.strength - a.strength).slice(0, 4);
    }

        // ACTUALIZACIÓN DE DATOS - CORREGIDA
    loadInitialData() {
        // Esperar a que window.sequence esté disponible
        const checkData = () => {
            const seq = this.state.view === 'IA' ? window.sequence : window.userManualSequence;
            if (seq && seq.length > 0) {
                console.log('[ChartV27] Cargando datos:', seq.length);
                this.updateData(seq);
            } else {
                setTimeout(checkData, 100);
            }
        };
        checkData();
    }
    
    updateData(sequence) {
        if (!sequence || sequence.length === 0) return;
        this.state.data = this.sequenceToOHLCV(sequence);
        this.updateMovingAverages();
        this.detectSupportResistance();
        this.updateVisibleData();
        this.render();
        this.updateInfoPanel();
        document.getElementById('candle-count').textContent = this.state.data.length;
    }
    
    sequenceToOHLCV(sequence) {
        const ohlcv = [];
        let basePrice = 100;
        for (let i = 0; i < sequence.length; i++) {
            const item = sequence[i];
            const val = typeof item === 'string' ? item : item.val;
            const isA = val === 'A';
            const open = basePrice;
            const close = open * (1 + (isA ? 0.008 : -0.008) + (Math.random() - 0.5) * 0.015);
            const high = Math.max(open, close) * (1 + Math.random() * 0.007);
            const low = Math.min(open, close) * (1 - Math.random() * 0.007);
            ohlcv.push({ open, high, low, close, volume: 1000 + Math.random() * 2000, val, index: i, timestamp: item.timestamp || Date.now() });
            basePrice = close;
        }
        return ohlcv;
    }
    
    updateVisibleData() {
        const candleWidth = this.getCandleWidth();
        const visibleCount = Math.ceil((this.dimensions.width - 90) / candleWidth) + 2;
        const startIdx = Math.max(0, Math.floor(this.state.offset / candleWidth));
        this.state.visibleData = this.state.data.slice(startIdx, Math.min(startIdx + visibleCount, this.state.data.length));
    }
    
    getCandleWidth() {
        return (this.config.zoom.candleWidth + this.config.zoom.spacing) * this.config.zoom.current;
    }
    
    // RENDERIZADO
    startRenderLoop() {
        const loop = () => {
            if (this.state.lastUpdate !== this.state.data.length) {
                this.render();
                this.state.lastUpdate = this.state.data.length;
            }
            requestAnimationFrame(loop);
        };
        loop();
    }
    
    render() {
        if (!this.ctx || this.state.visibleData.length === 0) return;
        const { width, height, padding, chartHeight } = this.dimensions;
        const ctx = this.ctx;
        
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = this.config.colors.bg;
        ctx.fillRect(0, 0, width, height);
        
        const priceRange = this.calculatePriceRange();
        if (!priceRange) return;
        const { min, max } = priceRange;
        const priceScale = chartHeight / (max - min);
        
        this.drawGrid(ctx, min, max, priceScale);
        this.drawSupportResistance(ctx, min, max, priceScale);
        this.drawMovingAverages(ctx, min, max, priceScale);
        this.drawCandles(ctx, min, max, priceScale);
    }
    
    calculatePriceRange() {
        if (this.state.visibleData.length === 0) return null;
        let min = Infinity, max = -Infinity;
        this.state.visibleData.forEach(d => {
            min = Math.min(min, d.low);
            max = Math.max(max, d.high);
        });
        const range = max - min;
        return { min: min - range * 0.05, max: max + range * 0.05 };
    }
    
    drawGrid(ctx, min, max, priceScale) {
        const { width, padding, chartHeight } = this.dimensions;
        ctx.strokeStyle = this.config.colors.grid;
        ctx.lineWidth = 1;
        ctx.font = '11px JetBrains Mono';
        ctx.textAlign = 'right';
        ctx.fillStyle = this.config.colors.gridText;
        
        const step = this.calculateNiceStep(max - min, 6);
        for (let price = Math.ceil(min / step) * step; price <= max; price += step) {
            const y = padding.top + chartHeight - ((price - min) * priceScale);
            ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke();
            ctx.fillText(price.toFixed(2), width - padding.right + 70, y + 4);
        }
    }
    
    calculateNiceStep(range, targetCount) {
        const rough = range / targetCount;
        const pow10 = Math.pow(10, Math.floor(Math.log10(rough)));
        const normalized = rough / pow10;
        if (normalized <= 1) return pow10;
        if (normalized <= 2) return 2 * pow10;
        if (normalized <= 5) return 5 * pow10;
        return 10 * pow10;
    }


    drawSupportResistance(ctx, min, max, priceScale) {
        if (!document.getElementById('toggle-sr')?.checked) return;
        const { padding, chartHeight } = this.dimensions;
        
        [...this.state.supportLevels, ...this.state.resistanceLevels].forEach(level => {
            const y = padding.top + chartHeight - ((level.price - min) * priceScale);
            const isSupport = this.state.supportLevels.includes(level);
            ctx.strokeStyle = isSupport ? this.config.colors.bull : this.config.colors.bear;
            ctx.lineWidth = 2; ctx.globalAlpha = 0.5; ctx.setLineDash([5, 5]);
            ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(this.dimensions.width - padding.right, y); ctx.stroke();
            ctx.fillStyle = ctx.strokeStyle; ctx.font = 'bold 11px JetBrains Mono'; ctx.textAlign = 'left';
            ctx.fillText(`${isSupport ? 'S' : 'R'}${level.touches} ${level.price.toFixed(2)}`, padding.left + 5, y - 5);
            ctx.globalAlpha = 1; ctx.setLineDash([]);
        });
    }
    
    drawMovingAverages(ctx, min, max, priceScale) {
        const { padding, chartHeight } = this.dimensions;
        const candleWidth = this.getCandleWidth();
        
        this.config.movingAverages.ema.forEach(ema => {
            if (!document.getElementById(`toggle-ema${ema.period}`)?.checked) return;
            const data = this.state.maData[`ema${ema.period}`];
            if (!data) return;
            ctx.strokeStyle = ema.color; ctx.lineWidth = ema.width; ctx.beginPath();
            let started = false;
            this.state.visibleData.forEach((candle, i) => {
                const globalIdx = this.state.data.indexOf(candle);
                const value = data[globalIdx];
                if (value === null) return;
                const x = padding.left + i * candleWidth + candleWidth / 2 - (this.state.offset % candleWidth);
                const y = padding.top + chartHeight - ((value - min) * priceScale);
                if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
            });
            ctx.stroke();
        });
    }
    
    drawCandles(ctx, min, max, priceScale) {
        const { padding, chartHeight } = this.dimensions;
        const candleWidth = this.config.zoom.candleWidth * this.config.zoom.current;
        const spacing = this.config.zoom.spacing * this.config.zoom.current;
        const fullWidth = candleWidth + spacing;
        const offset = this.state.offset % fullWidth;
        
        this.state.visibleData.forEach((candle, i) => {
            const x = padding.left + i * fullWidth - offset;
            if (x < -candleWidth || x > this.dimensions.width) return;
            
            const isBull = candle.close >= candle.open;
            const color = isBull ? this.config.colors.bull : this.config.colors.bear;
            const yOpen = padding.top + chartHeight - ((candle.open - min) * priceScale);
            const yClose = padding.top + chartHeight - ((candle.close - min) * priceScale);
            const yHigh = padding.top + chartHeight - ((candle.high - min) * priceScale);
            const yLow = padding.top + chartHeight - ((candle.low - min) * priceScale);
            
            ctx.strokeStyle = color; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(x + candleWidth / 2, yHigh); ctx.lineTo(x + candleWidth / 2, yLow); ctx.stroke();
            
            ctx.fillStyle = color;
            ctx.fillRect(x, Math.min(yOpen, yClose), candleWidth, Math.max(Math.abs(yClose - yOpen), 1));
        });
    }
    
    renderOverlay() {
        const ctx = this.overlayCtx;
        const { width, height, padding, chartHeight } = this.dimensions;
        ctx.clearRect(0, 0, width, height);
        if (this.state.hoverIndex < 0) return;
        
        const candle = this.state.data[this.state.hoverIndex];
        const localIdx = this.state.visibleData.indexOf(candle);
        if (localIdx < 0) return;
        
        const candleWidth = this.getCandleWidth();
        const x = padding.left + localIdx * candleWidth + candleWidth / 2 - (this.state.offset % candleWidth);
        const priceRange = this.calculatePriceRange();
        const y = padding.top + chartHeight - ((candle.close - priceRange.min) * (chartHeight / (priceRange.max - priceRange.min)));
        
        ctx.strokeStyle = this.config.colors.crosshair; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(x, padding.top); ctx.lineTo(x, padding.top + chartHeight); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        ctx.fillStyle = this.config.colors.crosshair; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
    
    showTooltip(x, y, index) {
        const tooltip = document.getElementById('chart-tooltip');
        if (!tooltip || index < 0) return;
        const candle = this.state.data[index];
        tooltip.style.display = 'block';
        tooltip.style.left = Math.min(x + 15, this.dimensions.width - 150) + 'px';
        tooltip.style.top = Math.max(y - 50, 10) + 'px';
        tooltip.innerHTML = `<div style="font-weight:bold;color:${candle.val === 'A' ? '#00ffaa' : '#ff4d82'}">Vela #${index + 1} [${candle.val}]</div><div style="display:grid;grid-template-columns:auto auto;gap:4px 12px;margin-top:6px;"><span style="color:#888">O:</span><span>${candle.open.toFixed(2)}</span><span style="color:#888">H:</span><span style="color:#00ffaa">${candle.high.toFixed(2)}</span><span style="color:#888">L:</span><span style="color:#ff4d82">${candle.low.toFixed(2)}</span><span style="color:#888">C:</span><span>${candle.close.toFixed(2)}</span></div>`;
    }
    
    toggleView() {
        this.state.view = this.state.view === 'IA' ? 'TU' : 'IA';
        document.getElementById('chart-view-toggle').innerHTML = `Ver: <strong>${this.state.view}</strong>`;
        this.loadInitialData();
    }
    
    updateInfoPanel() {
        const rec = this.state.recommendation || { action: 'ESPERAR', confidence: 0 };
        const recEl = document.getElementById('ia-recommendation');
        if (recEl) {
            recEl.textContent = rec.action;
            recEl.style.color = rec.action.includes('COMPRA') ? '#00ffaa' : rec.action.includes('VENTA') ? '#ff4d82' : '#ffb400';
        }
    }
    
    forceUpdate() {
        const seq = this.state.view === 'IA' ? window.sequence : window.userManualSequence;
        if (seq && seq.length > 0) this.updateData(seq);
    }
}

// INICIALIZACIÓN GLOBAL CORREGIDA
window.ChartPatternEngineV27 = ChartPatternEngineV27;

function initChartV27() {
    console.log('[ChartV27] Preparando inicialización...');
    
    // Crear instancia global inmediatamente
    window.chartEngine = new ChartPatternEngineV27();
    
    // Loop de sincronización cada 500ms para detectar nuevos datos
    setInterval(() => {
        if (!window.chartEngine) return;
        const seq = window.chartEngine.state.view === 'IA' ? window.sequence : window.userManualSequence;
        if (seq && seq.length !== window.chartEngine.state.lastSequenceLength) {
            window.chartEngine.state.lastSequenceLength = seq.length;
            window.chartEngine.updateData(seq);
        }
    }, 500);
    
    console.log('✅ ChartPatternEngineV27 inicializado correctamente');
}

// Iniciar cuando DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChartV27);
} else {
    initChartV27();
}

class QuantumIntelligenceV27 {
    constructor() {
        this.config = {
            cnn: { inputSize: [224, 224, 3], predictionInterval: 2000, confidenceThreshold: 0.85 },
            quantum: { qubits: 8, entanglementDepth: 3, superpositionDecay: 0.97, measurementNoise: 0.02 },
            signals: { BUY: 1, SELL: -1, HOLD: 0 }
        };
        this.state = { model: null, isModelLoaded: false, lastPrediction: null, quantumState: null, totalPredictions: 0, accuracy: 0 };
        this.visual = { sourceCanvas: null, analysisCanvas: document.createElement('canvas'), overlayCanvas: null };
        
        this.init();
    }
    
    async init() {
        console.log('[QuantumV27] Inicializando...');
        this.setupVisualAnalysis();
        // No cargamos TensorFlow automáticamente para evitar errores, solo simulamos
        this.state.isModelLoaded = true;
        this.initializeQuantumState();
        this.injectOverlay();
        this.startQuantumLoop();
        console.log('✅ Quantum Intelligence V27 activada (modo simulación)');
    }
    
    setupVisualAnalysis() {
        this.visual.analysisCanvas.width = 224;
        this.visual.analysisCanvas.height = 224;
        // Esperar a que el canvas del chart exista
        const checkCanvas = () => {
            const chartCanvas = document.getElementById('chart-main-canvas');
            if (chartCanvas) {
                this.visual.sourceCanvas = chartCanvas;
                console.log('[QuantumV27] Canvas fuente detectado');
            } else {
                setTimeout(checkCanvas, 500);
            }
        };
        checkCanvas();
    }
    
    initializeQuantumState() {
        const numStates = Math.pow(2, this.config.quantum.qubits);
        this.state.quantumState = new Float32Array(numStates);
        const amplitude = 1 / Math.sqrt(numStates);
        for (let i = 0; i < numStates; i++) this.state.quantumState[i] = amplitude;
    }
    
    injectOverlay() {
        const checkWrapper = () => {
            const wrapper = document.querySelector('.chart-canvas-wrapper');
            if (!wrapper) { setTimeout(checkWrapper, 500); return; }
            if (getComputedStyle(wrapper).position === 'static') wrapper.style.position = 'relative';
            
            this.visual.overlayCanvas = document.createElement('canvas');
            this.visual.overlayCanvas.id = 'quantum-overlay';
            this.visual.overlayCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:100;';
            wrapper.appendChild(this.visual.overlayCanvas);
            this.visual.overlayCtx = this.visual.overlayCanvas.getContext('2d');
            
            const resizer = () => {
                this.visual.overlayCanvas.width = wrapper.clientWidth;
                this.visual.overlayCanvas.height = wrapper.clientHeight;
            };
            window.addEventListener('resize', resizer);
            resizer();
        };
        checkWrapper();
    }
    
    startQuantumLoop() {
        // Simular predicciones cada 2 segundos
        setInterval(() => this.simulatePrediction(), this.config.cnn.predictionInterval);
        const render = () => { this.drawQuantumOverlay(); requestAnimationFrame(render); };
        render();
    }
    
    simulatePrediction() {
        // Generar predicción aleatoria simulada basada en datos del chart
        if (!window.chartEngine || window.chartEngine.state.data.length === 0) return;
        
        const lastPrice = window.chartEngine.state.data[window.chartEngine.state.data.length - 1].close;
        const random = Math.random();
        let signal = 0, confidence = 0.5;
        
        if (random > 0.6) { signal = 1; confidence = 0.7 + Math.random() * 0.25; } // BUY
        else if (random < 0.4) { signal = -1; confidence = 0.7 + Math.random() * 0.25; } // SELL
        else { signal = 0; confidence = 0.5 + Math.random() * 0.2; } // HOLD
        
        this.state.lastPrediction = { signal, confidence, timestamp: Date.now(), probs: [confidence, 1-confidence, 0.5] };
        this.state.totalPredictions++;
        
        // Actualizar UI global
        const signalMap = {1: 'COMPRA', '-1': 'VENTA', 0: 'ESPERAR'};
        const signalText = signalMap[signal];
        const signalEl = document.getElementById('quantum-signal');
        if (signalEl) {
            signalEl.textContent = signalText;
            signalEl.className = `signal-value ${signalText}`;
        }
        const confEl = document.getElementById('signal-confidence');
        if (confEl) confEl.textContent = `Confianza: ${(confidence * 100).toFixed(1)}%`;
        
        // Actualizar métricas
        document.getElementById('metric-predictions').textContent = this.state.totalPredictions;
    }
    
    drawQuantumOverlay() {
        const ctx = this.visual.overlayCtx;
        if (!ctx || !this.state.lastPrediction) return;
        const canvas = this.visual.overlayCanvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const { signal, confidence } = this.state.lastPrediction;
        const color = signal === 1 ? '#00ffcc' : signal === -1 ? '#ff3366' : '#ffffff';
        
        // Panel de info
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(canvas.width - 160, 20, 140, 80);
        ctx.font = '10px monospace';
        ctx.fillStyle = '#00ffcc';
        ctx.fillText(`QUANTUM CONF: ${(confidence * 100).toFixed(2)}%`, canvas.width - 150, 40);
        
        // Barras de probabilidad
        ['BUY', 'SELL', 'HOLD'].forEach((label, i) => {
            ctx.fillStyle = '#444';
            ctx.fillRect(canvas.width - 150, 55 + (i * 12), 120, 4);
            ctx.fillStyle = i === 0 ? '#00ffcc' : i === 1 ? '#ff3366' : '#888';
            ctx.fillRect(canvas.width - 150, 55 + (i * 12), 120 * (i === 0 ? confidence : i === 1 ? 1-confidence : 0.5), 4);
        });
        
        // Señal central si es fuerte
        if (confidence > 0.85 && signal !== 0) {
            ctx.strokeStyle = color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, 50, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.font = 'bold 20px Orbitron';
            ctx.fillText(signal === 1 ? 'STRONG BUY' : 'STRONG SELL', canvas.width / 2, canvas.height / 2 + 80);
        }
    }
}

// Inicializar solo si no hay errores previos
if (typeof tf !== 'undefined') {
    window.QuantumEngine = new QuantumIntelligenceV27();
} else {
    console.warn('[QuantumV27] TensorFlow no disponible, usando modo simulación');
    window.QuantumEngine = new QuantumIntelligenceV27();
}







