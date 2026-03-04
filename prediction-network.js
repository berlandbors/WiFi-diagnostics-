/**
 * prediction-network.js
 * Рекуррентная нейронная сеть (RNN) для прогнозирования качества WiFi.
 * Реализована на чистом JavaScript без внешних библиотек ML.
 *
 * Архитектура:
 *   Вход: 10 временных шагов × 6 параметров
 *   Скрытый слой: 16 рекуррентных нейронов
 *   Выход: 12 значений (4 класса × 3 временных окна: 15, 30, 60 мин)
 */

'use strict';

// ─── Вспомогательные функции активации ───────────────────────────────────────

/** Сигмоидная функция активации */
function sigmoid(x) {
    return 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x))));
}

/** Гиперболический тангенс */
function tanh(x) {
    return Math.tanh(x);
}

/** Softmax для нормализации вероятностей */
function softmax(arr) {
    const max = Math.max(...arr);
    const exps = arr.map(x => Math.exp(x - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(e => e / sum);
}

// ─── Класс RecurrentNeuralNetwork ────────────────────────────────────────────

class RecurrentNeuralNetwork {
    /**
     * @param {number} inputSize   - размер входного вектора на каждом шаге
     * @param {number} hiddenSize  - количество скрытых нейронов
     * @param {number} outputSize  - размер выходного вектора
     */
    constructor(inputSize, hiddenSize, outputSize) {
        this.inputSize  = inputSize;
        this.hiddenSize = hiddenSize;
        this.outputSize = outputSize;

        // Инициализация весов методом Xavier
        this._initWeights();

        // Скрытое состояние
        this.hiddenState = new Array(hiddenSize).fill(0);

        // История потерь
        this.trainingLossHistory = [];
        this.trainedSamples = 0;
    }

    /** Инициализация весов нейросети методом Xavier */
    _initWeights() {
        const { inputSize: I, hiddenSize: H, outputSize: O } = this;

        // Xavier для весов входа → скрытый слой
        const scaleIH = Math.sqrt(6 / (I + H));
        // Xavier для весов скрытый → скрытый (рекуррентные)
        const scaleHH = Math.sqrt(6 / (H + H));
        // Xavier для весов скрытый → выход
        const scaleHO = Math.sqrt(6 / (H + O));

        // W_ih: H × I  — веса вход → скрытый
        this.W_ih = this._randMatrix(H, I, scaleIH);
        // W_hh: H × H  — рекуррентные веса
        this.W_hh = this._randMatrix(H, H, scaleHH);
        // b_h:  H       — смещения скрытого слоя
        this.b_h  = new Array(H).fill(0);

        // W_ho: O × H  — веса скрытый → выход
        this.W_ho = this._randMatrix(O, H, scaleHO);
        // b_o:  O       — смещения выходного слоя
        this.b_o  = new Array(O).fill(0);
    }

    /** Случайная матрица размера rows × cols с равномерным распределением [-scale, scale] */
    _randMatrix(rows, cols, scale) {
        return Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => (Math.random() * 2 - 1) * scale)
        );
    }

    /** Сброс скрытого состояния */
    resetState() {
        this.hiddenState = new Array(this.hiddenSize).fill(0);
    }

    /**
     * Прямой проход через один временной шаг.
     * @param {number[]} input - входной вектор (длина inputSize)
     * @returns {number[]} выходной вектор
     */
    stepForward(input) {
        const H = this.hiddenSize;
        const newHidden = new Array(H);

        for (let h = 0; h < H; h++) {
            let sum = this.b_h[h];
            // Взвешенная сумма от входа
            for (let i = 0; i < this.inputSize; i++) {
                sum += this.W_ih[h][i] * input[i];
            }
            // Взвешенная сумма от предыдущего скрытого состояния
            for (let hh = 0; hh < H; hh++) {
                sum += this.W_hh[h][hh] * this.hiddenState[hh];
            }
            newHidden[h] = tanh(sum);
        }

        this.hiddenState = newHidden;

        // Вычисляем выход
        const output = new Array(this.outputSize);
        for (let o = 0; o < this.outputSize; o++) {
            let sum = this.b_o[o];
            for (let h = 0; h < H; h++) {
                sum += this.W_ho[o][h] * newHidden[h];
            }
            output[o] = sum;
        }

        return output;
    }

    /**
     * Полный проход по последовательности.
     * @param {number[][]} sequence - массив входных векторов
     * @returns {number[]} выходной вектор последнего шага
     */
    forward(sequence) {
        this.resetState();
        let output;
        for (const step of sequence) {
            output = this.stepForward(step);
        }
        return output;
    }

    /**
     * Упрощённое обучение через стохастический градиентный спуск
     * с BPTT (Backpropagation Through Time) на один шаг.
     * @param {number[][]} sequence - входная последовательность
     * @param {number[]}   target   - целевые значения
     * @param {number}     lr       - скорость обучения
     * @returns {number} значение функции потерь (MSE)
     */
    train(sequence, target, lr = 0.01) {
        // Прямой проход с сохранением состояний
        this.resetState();
        const states = [this.hiddenState.slice()];
        const inputs = [];
        let rawOutput;

        for (const step of sequence) {
            rawOutput = this.stepForward(step);
            states.push(this.hiddenState.slice());
            inputs.push(step);
        }

        // Применяем softmax по группам из 4 выходов (для каждого временного окна)
        const finalOutput = [];
        for (let w = 0; w < 3; w++) {
            const group = softmax(rawOutput.slice(w * 4, w * 4 + 4));
            finalOutput.push(...group);
        }

        // Вычисляем ошибку (MSE)
        let loss = 0;
        const outputDelta = new Array(this.outputSize);
        for (let o = 0; o < this.outputSize; o++) {
            const err = finalOutput[o] - target[o];
            loss += err * err;
            outputDelta[o] = err * 2 / this.outputSize;
        }
        loss /= this.outputSize;

        // Градиент скрытого состояния через выходной слой
        const hiddenDelta = new Array(this.hiddenSize).fill(0);
        for (let h = 0; h < this.hiddenSize; h++) {
            for (let o = 0; o < this.outputSize; o++) {
                hiddenDelta[h] += outputDelta[o] * this.W_ho[o][h];
            }
            hiddenDelta[h] *= (1 - this.hiddenState[h] * this.hiddenState[h]);
        }

        // Обновляем веса выходного слоя
        for (let o = 0; o < this.outputSize; o++) {
            for (let h = 0; h < this.hiddenSize; h++) {
                this.W_ho[o][h] -= lr * outputDelta[o] * this.hiddenState[h];
            }
            this.b_o[o] -= lr * outputDelta[o];
        }

        // Обновляем веса скрытого слоя
        const lastInput = inputs[inputs.length - 1] || new Array(this.inputSize).fill(0);
        const prevState = states[states.length - 2] || new Array(this.hiddenSize).fill(0);

        for (let h = 0; h < this.hiddenSize; h++) {
            for (let i = 0; i < this.inputSize; i++) {
                this.W_ih[h][i] -= lr * hiddenDelta[h] * lastInput[i];
            }
            for (let hh = 0; hh < this.hiddenSize; hh++) {
                this.W_hh[h][hh] -= lr * hiddenDelta[h] * prevState[hh];
            }
            this.b_h[h] -= lr * hiddenDelta[h];
        }

        this.trainedSamples++;
        this.trainingLossHistory.push(loss);
        // Ограничиваем историю потерь до 200 значений
        if (this.trainingLossHistory.length > 200) {
            this.trainingLossHistory.shift();
        }

        return loss;
    }

    /** Экспорт весов для сохранения */
    exportWeights() {
        return {
            W_ih: this.W_ih,
            W_hh: this.W_hh,
            b_h:  this.b_h,
            W_ho: this.W_ho,
            b_o:  this.b_o,
            trainedSamples: this.trainedSamples
        };
    }

    /** Импорт весов из сохранения */
    importWeights(data) {
        try {
            this.W_ih = data.W_ih;
            this.W_hh = data.W_hh;
            this.b_h  = data.b_h;
            this.W_ho = data.W_ho;
            this.b_o  = data.b_o;
            this.trainedSamples = data.trainedSamples || 0;
        } catch (e) {
            console.error('[RNN] Ошибка импорта весов:', e);
        }
    }
}

// ─── Класс TimeSeriesPredictor ────────────────────────────────────────────────

/**
 * Специализированный предсказатель качества сети на основе RNN.
 * Прогнозирует качество на 15, 30 и 60 минут вперёд.
 */
class TimeSeriesPredictor {
    constructor() {
        // 10 временных шагов × 6 параметров → 16 скрытых → 12 выходов
        this.rnn = new RecurrentNeuralNetwork(6, 16, 12);

        // Размер входного окна (количество прошлых измерений)
        this.windowSize = 10;

        // Нормализационные параметры (будут обновляться при обучении)
        this.normParams = {
            speed:      { min: 0, max: 100 },
            rtt:        { min: 0, max: 1000 },
            jitter:     { min: 0, max: 100 },
            packetLoss: { min: 0, max: 100 }
        };

        // Классы качества (индексы)
        this.qualityClasses = ['Отличное', 'Хорошее', 'Среднее', 'Плохое'];

        // Временные окна прогноза (минуты)
        this.timeWindows = [15, 30, 60];

        // Счётчик для периодического переобучения
        this.testsSinceRetrain = 0;

        // Последний результат прогноза
        this.lastPrediction = null;

        // Загружаем сохранённые веса, если есть
        this._loadWeights();
    }

    /** Нормализация параметра в диапазон [0, 1] */
    _normalize(value, min, max) {
        if (max === min) return 0;
        return Math.max(0, Math.min(1, (value - min) / (max - min)));
    }

    /**
     * Преобразование записи БД в входной вектор нейросети.
     * @param {object} record - запись из SmartStorageManager
     * @returns {number[]} вектор из 6 значений
     */
    _recordToVector(record) {
        return [
            this._normalize(record.speed      || 0, this.normParams.speed.min,      this.normParams.speed.max),
            this._normalize(record.rtt        || 0, this.normParams.rtt.min,        this.normParams.rtt.max),
            this._normalize(record.jitter     || 0, this.normParams.jitter.min,     this.normParams.jitter.max),
            this._normalize(record.packetLoss || 0, this.normParams.packetLoss.min, this.normParams.packetLoss.max),
            (record.hour        || 0) / 23,
            (record.dayOfWeek   || 0) / 6
        ];
    }

    /**
     * Создание целевого вектора для обучения по известному качеству.
     * @param {string} quality - строка качества ('Отличное', 'Хорошее', и т.д.)
     * @returns {number[]} one-hot вектор длиной 12 (4 класса × 3 временных окна)
     */
    _qualityToTarget(quality) {
        const idx = this.qualityClasses.indexOf(quality);
        const oneHot = this.qualityClasses.map((_, i) => i === idx ? 1 : 0);
        // Одинаковое распределение для всех 3 временных окон
        return [...oneHot, ...oneHot, ...oneHot];
    }

    /**
     * Обновление нормализационных параметров на основе данных.
     * @param {object[]} records - массив записей
     */
    _updateNormParams(records) {
        if (!records.length) return;
        const speeds  = records.map(r => r.speed      || 0).filter(v => v > 0);
        const rtts    = records.map(r => r.rtt        || 0).filter(v => v > 0);
        const jitters = records.map(r => r.jitter     || 0).filter(v => v > 0);

        if (speeds.length) {
            this.normParams.speed.max = Math.max(speeds.reduce((a, b) => Math.max(a, b), 0) * 1.2, 10);
        }
        if (rtts.length) {
            this.normParams.rtt.max = Math.max(rtts.reduce((a, b) => Math.max(a, b), 0) * 1.2, 100);
        }
        if (jitters.length) {
            this.normParams.jitter.max = Math.max(jitters.reduce((a, b) => Math.max(a, b), 0) * 1.2, 20);
        }
    }

    /**
     * Обучение модели на массиве записей.
     * @param {object[]} records - массив записей из SmartStorageManager
     * @returns {number} средняя потеря за эпоху
     */
    trainOnData(records) {
        if (records.length < this.windowSize + 1) return null;

        // Обновляем нормализационные параметры
        this._updateNormParams(records);

        let totalLoss = 0;
        let count = 0;

        // Обучаемся на скользящих окнах по всем данным
        for (let i = this.windowSize; i < records.length; i++) {
            const sequence = records.slice(i - this.windowSize, i).map(r => this._recordToVector(r));
            const target   = this._qualityToTarget(records[i].quality || 'Среднее');
            totalLoss += this.rnn.train(sequence, target, 0.005);
            count++;
        }

        const avgLoss = count > 0 ? totalLoss / count : 0;
        this._saveWeights();
        return avgLoss;
    }

    /**
     * Прогнозирование качества на основе последних записей.
     * @param {object[]} records - массив последних записей (нужно минимум windowSize)
     * @returns {object|null} объект с прогнозами для каждого временного окна
     */
    predict(records) {
        if (records.length < this.windowSize) return null;

        // Берём последние windowSize записей
        const recentRecords = records.slice(-this.windowSize);
        const sequence = recentRecords.map(r => this._recordToVector(r));

        const rawOutput = this.rnn.forward(sequence);

        // Применяем softmax по группам для каждого временного окна
        const predictions = {};
        this.timeWindows.forEach((minutes, w) => {
            const group = softmax(rawOutput.slice(w * 4, w * 4 + 4));
            const bestIdx = group.indexOf(Math.max(...group));
            predictions[minutes] = {
                quality:       this.qualityClasses[bestIdx],
                confidence:    Math.round(group[bestIdx] * 100),
                probabilities: group.map((p, i) => ({ class: this.qualityClasses[i], prob: Math.round(p * 100) }))
            };
        });

        this.lastPrediction = { timestamp: Date.now(), predictions };
        return this.lastPrediction;
    }

    /**
     * Анализ паттернов использования сети.
     * @param {object[]} records - все записи из SmartStorageManager
     * @returns {object} объект с паттернами
     */
    analyzePatterns(records) {
        if (records.length < 5) return null;

        // Группируем данные по часам
        const hourlyData = {};
        for (let h = 0; h < 24; h++) {
            hourlyData[h] = { speeds: [], rtts: [], count: 0 };
        }

        records.forEach(r => {
            const h = r.hour !== undefined ? r.hour : new Date(r.timestamp).getHours();
            if (hourlyData[h]) {
                hourlyData[h].speeds.push(r.speed || 0);
                hourlyData[h].rtts.push(r.rtt || 0);
                hourlyData[h].count++;
            }
        });

        // Считаем средние по часам
        const hourlyAvg = {};
        for (let h = 0; h < 24; h++) {
            const d = hourlyData[h];
            if (d.count > 0) {
                hourlyAvg[h] = {
                    speed: d.speeds.reduce((a, b) => a + b, 0) / d.count,
                    rtt:   d.rtts.reduce((a, b) => a + b, 0) / d.count,
                    count: d.count
                };
            }
        }

        // Находим лучшие и худшие часы
        const hoursWithData = Object.entries(hourlyAvg).filter(([, v]) => v.count > 0);
        if (!hoursWithData.length) return null;

        hoursWithData.sort((a, b) => b[1].speed - a[1].speed);
        const bestHours  = hoursWithData.slice(0, 3).map(([h, v]) => ({
            hour: parseInt(h), speed: Math.round(v.speed * 10) / 10, rtt: Math.round(v.rtt)
        }));
        const worstHours = hoursWithData.slice(-3).reverse().map(([h, v]) => ({
            hour: parseInt(h), speed: Math.round(v.speed * 10) / 10, rtt: Math.round(v.rtt)
        }));

        // Суточный тренд (24 слота)
        const dailyTrend = Array.from({ length: 24 }, (_, h) =>
            hourlyAvg[h] ? Math.round(hourlyAvg[h].speed * 10) / 10 : null
        );

        // Общая статистика
        const allSpeeds = records.map(r => r.speed || 0).filter(v => v > 0);
        const avgSpeed  = allSpeeds.length ? allSpeeds.reduce((a, b) => a + b, 0) / allSpeeds.length : 0;

        return {
            bestHours,
            worstHours,
            dailyTrend,
            avgSpeed:    Math.round(avgSpeed * 10) / 10,
            totalPoints: records.length,
            hourlyAvg
        };
    }

    /** Сохранение весов модели в localStorage */
    _saveWeights() {
        try {
            const data = {
                weights: this.rnn.exportWeights(),
                normParams: this.normParams,
                timestamp: Date.now()
            };
            localStorage.setItem('rnn_weights', JSON.stringify(data));
        } catch (e) {
            console.warn('[RNN] Не удалось сохранить веса:', e);
        }
    }

    /** Загрузка весов модели из localStorage */
    _loadWeights() {
        try {
            const raw = localStorage.getItem('rnn_weights');
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data.weights)    this.rnn.importWeights(data.weights);
            if (data.normParams) this.normParams = data.normParams;
        } catch (e) {
            console.warn('[RNN] Не удалось загрузить веса:', e);
        }
    }

    /** Сброс модели к начальным значениям */
    reset() {
        this.rnn._initWeights();
        this.rnn.trainingLossHistory = [];
        this.rnn.trainedSamples = 0;
        this.testsSinceRetrain = 0;
        this.lastPrediction = null;
        localStorage.removeItem('rnn_weights');
    }
}
