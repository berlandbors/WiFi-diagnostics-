/**
 * neural-network.js
 * Многослойная нейронная сеть (MLP) на чистом JavaScript без внешних библиотек.
 * Используется для интеллектуального анализа качества WiFi соединения.
 *
 * Архитектура: 6 входов → 8 скрытых → 6 скрытых → 4 выхода
 *
 * Входные данные:
 *   [speed, rtt, jitter, packetLoss, timeOfDay, connectionType]
 *
 * Выходные данные:
 *   [excellent, good, fair, poor] — вероятности каждого класса качества
 */

'use strict';

// ─── Класс NeuralNetwork ──────────────────────────────────────────────────────

class NeuralNetwork {
    /**
     * @param {number} inputSize       - количество входных нейронов
     * @param {number[]} hiddenSizes   - массив размеров скрытых слоёв
     * @param {number} outputSize      - количество выходных нейронов
     */
    constructor(inputSize, hiddenSizes, outputSize) {
        this.inputSize   = inputSize;
        this.hiddenSizes = Array.isArray(hiddenSizes) ? hiddenSizes : [hiddenSizes];
        this.outputSize  = outputSize;

        // История потерь при обучении (для визуализации)
        this.trainingLossHistory = [];

        // Инициализация весов и смещений
        this._initWeights();
    }

    /**
     * Инициализация весов методом Xavier/He.
     * Для каждого слоя создаём матрицу весов и вектор смещений.
     * Xavier: W ~ Uniform(-sqrt(6/(fan_in+fan_out)), sqrt(6/(fan_in+fan_out)))
     */
    _initWeights() {
        // Собираем размеры всех слоёв в одном массиве
        const layerSizes = [this.inputSize, ...this.hiddenSizes, this.outputSize];

        // weights[i] — матрица весов между слоями i и i+1, размер: [layerSizes[i+1]][layerSizes[i]]
        // biases[i]  — вектор смещений слоя i+1, размер: [layerSizes[i+1]]
        this.weights = [];
        this.biases  = [];

        for (let i = 0; i < layerSizes.length - 1; i++) {
            const fanIn  = layerSizes[i];
            const fanOut = layerSizes[i + 1];
            const limit  = Math.sqrt(6 / (fanIn + fanOut)); // Xavier limit

            // Создаём матрицу весов [fanOut x fanIn]
            const W = [];
            for (let r = 0; r < fanOut; r++) {
                W.push(new Array(fanIn).fill(0).map(() => (Math.random() * 2 - 1) * limit));
            }
            this.weights.push(W);

            // Смещения инициализируем нулями
            this.biases.push(new Array(fanOut).fill(0));
        }
    }

    // ─── Активационные функции ────────────────────────────────────────────────

    /** Сигмоидальная функция активации: f(x) = 1 / (1 + e^(-x)) */
    sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }

    /** Производная сигмоиды: f'(x) = f(x) * (1 - f(x)) */
    sigmoidDerivative(x) {
        const s = this.sigmoid(x);
        return s * (1 - s);
    }

    /** ReLU: f(x) = max(0, x) */
    relu(x) {
        return Math.max(0, x);
    }

    /** Производная ReLU: f'(x) = 1 если x > 0, иначе 0 */
    reluDerivative(x) {
        return x > 0 ? 1 : 0;
    }

    /**
     * Softmax — нормализация выходного вектора в вероятности.
     * Используется на выходном слое для классификации.
     * @param {number[]} arr
     * @returns {number[]}
     */
    softmax(arr) {
        // Стабильный softmax: вычитаем максимум для предотвращения переполнения
        const maxVal = Math.max(...arr);
        const exps   = arr.map(x => Math.exp(x - maxVal));
        const sum    = exps.reduce((a, b) => a + b, 0);
        return exps.map(e => e / sum);
    }

    // ─── Прямое распространение ───────────────────────────────────────────────

    /**
     * Прямое распространение сигнала через все слои.
     * Скрытые слои используют Sigmoid, выходной — Softmax.
     * @param {number[]} input - входной вектор
     * @returns {{ activations: number[][], zValues: number[][] }}
     *   activations[i] — активации i-го слоя (включая входной)
     *   zValues[i]     — взвешенные суммы i-го слоя (без активации)
     */
    forward(input) {
        const activations = [input.slice()]; // activations[0] = входные данные
        const zValues     = [];

        let current = input.slice();

        for (let i = 0; i < this.weights.length; i++) {
            const W    = this.weights[i];
            const b    = this.biases[i];
            const next = [];

            // z[j] = sum(W[j][k] * current[k]) + b[j]
            for (let j = 0; j < W.length; j++) {
                let z = b[j];
                for (let k = 0; k < current.length; k++) {
                    z += W[j][k] * current[k];
                }
                next.push(z);
            }

            zValues.push(next);

            // Активация: Sigmoid для скрытых слоёв, Softmax для выходного
            const isOutputLayer = i === this.weights.length - 1;
            current = isOutputLayer ? this.softmax(next) : next.map(z => this.sigmoid(z));
            activations.push(current.slice());
        }

        return { activations, zValues };
    }

    /**
     * Предсказание: возвращает только выходной вектор (вероятности).
     * @param {number[]} input
     * @returns {number[]}
     */
    predict(input) {
        const { activations } = this.forward(input);
        return activations[activations.length - 1];
    }

    // ─── Обратное распространение ─────────────────────────────────────────────

    /**
     * Обратное распространение ошибки (Backpropagation).
     * Обновляет веса и смещения с использованием градиентного спуска.
     * Функция потерь: Categorical Cross-Entropy
     *   L = -sum(target[i] * log(output[i]))
     *
     * @param {number[]} input       - входной вектор
     * @param {number[]} target      - целевой выходной вектор (one-hot)
     * @param {number}   learningRate - скорость обучения
     * @returns {number} - значение функции потерь
     */
    backward(input, target, learningRate) {
        const { activations, zValues } = this.forward(input);
        const output = activations[activations.length - 1];

        // Cross-Entropy Loss: L = -sum(target * log(output + eps))
        const eps  = 1e-7;
        const loss = -target.reduce((sum, t, i) => sum + t * Math.log(output[i] + eps), 0);

        // Инициализируем массивы для хранения дельт слоёв
        const deltas = new Array(this.weights.length);

        // ─── Дельта выходного слоя ─────────────────────────────────────────
        // Для Softmax + Cross-Entropy производная упрощается до: delta = output - target
        deltas[deltas.length - 1] = output.map((o, i) => o - target[i]);

        // ─── Дельты скрытых слоёв (обратный проход) ───────────────────────
        for (let i = this.weights.length - 2; i >= 0; i--) {
            const W         = this.weights[i + 1];     // матрица весов следующего слоя
            const delta     = deltas[i + 1];           // дельта следующего слоя
            const zCurrent  = zValues[i];              // взвешенные суммы текущего слоя
            const newDelta  = [];

            // delta[i][k] = (sum_j W[j][k] * delta[j]) * sigmoid'(z[k])
            for (let k = 0; k < zCurrent.length; k++) {
                let sum = 0;
                for (let j = 0; j < W.length; j++) {
                    sum += W[j][k] * delta[j];
                }
                newDelta.push(sum * this.sigmoidDerivative(zCurrent[k]));
            }

            deltas[i] = newDelta;
        }

        // ─── Обновление весов и смещений ──────────────────────────────────
        for (let i = 0; i < this.weights.length; i++) {
            const delta      = deltas[i];
            const activation = activations[i]; // активации предыдущего слоя

            for (let j = 0; j < this.weights[i].length; j++) {
                // Обновление смещения: b[j] -= lr * delta[j]
                this.biases[i][j] -= learningRate * delta[j];

                // Обновление весов: W[j][k] -= lr * delta[j] * activation[k]
                for (let k = 0; k < this.weights[i][j].length; k++) {
                    this.weights[i][j][k] -= learningRate * delta[j] * activation[k];
                }
            }
        }

        return loss;
    }

    // ─── Обучение на батче данных ─────────────────────────────────────────────

    /**
     * Обучение на наборе данных в течение нескольких эпох.
     * @param {Array<{input: number[], output: number[]}>} trainingData
     * @param {number} epochs        - количество эпох
     * @param {number} learningRate  - скорость обучения
     * @returns {{ finalLoss: number, accuracy: number, lossHistory: number[] }}
     */
    train(trainingData, epochs, learningRate) {
        const lossHistory = [];

        for (let epoch = 0; epoch < epochs; epoch++) {
            let totalLoss    = 0;
            let correctCount = 0;

            // Перемешиваем данные в каждую эпоху для лучшей сходимости
            const shuffled = trainingData.slice().sort(() => Math.random() - 0.5);

            for (const sample of shuffled) {
                const loss = this.backward(sample.input, sample.output, learningRate);
                totalLoss += loss;

                // Проверяем точность предсказания
                const prediction = this.predict(sample.input);
                const predIndex  = prediction.indexOf(Math.max(...prediction));
                const targIndex  = sample.output.indexOf(Math.max(...sample.output));
                if (predIndex === targIndex) correctCount++;
            }

            const avgLoss = totalLoss / shuffled.length;
            lossHistory.push(avgLoss);
        }

        // Сохраняем историю потерь для визуализации
        this.trainingLossHistory = lossHistory;

        // Вычисляем итоговую точность
        let correct = 0;
        for (const sample of trainingData) {
            const prediction = this.predict(sample.input);
            const predIndex  = prediction.indexOf(Math.max(...prediction));
            const targIndex  = sample.output.indexOf(Math.max(...sample.output));
            if (predIndex === targIndex) correct++;
        }

        const accuracy  = (correct / trainingData.length) * 100;
        const finalLoss = lossHistory[lossHistory.length - 1];

        return { finalLoss, accuracy, lossHistory };
    }

    // ─── Сериализация модели ──────────────────────────────────────────────────

    /**
     * Получить веса и смещения для сохранения.
     * @returns {{ weights: number[][][], biases: number[][] }}
     */
    getWeights() {
        return {
            weights: this.weights.map(W => W.map(row => row.slice())),
            biases:  this.biases.map(b => b.slice())
        };
    }

    /**
     * Загрузить веса и смещения из сохранённого объекта.
     * @param {{ weights: number[][][], biases: number[][] }} data
     */
    setWeights(data) {
        if (data && data.weights && data.biases) {
            this.weights = data.weights;
            this.biases  = data.biases;
        }
    }
}

// ─── Класс WiFiNeuralAnalyzer ─────────────────────────────────────────────────

class WiFiNeuralAnalyzer {
    constructor() {
        // Архитектура: 6 входов → 8 скрытых → 6 скрытых → 4 выхода
        this.network         = new NeuralNetwork(6, [8, 6], 4);
        this.trainingHistory = [];
        this.lastTrainedTime = null;
        this.modelAccuracy   = 0;

        this.loadModel();
    }

    // ─── Нормализация входных данных ──────────────────────────────────────────

    /**
     * Нормализация метрик в диапазон [0, 1].
     * @param {number} speed          - скорость Mbps (0–200)
     * @param {number} rtt            - задержка ms (0–500)
     * @param {number} jitter         - джиттер ms (0–100)
     * @param {number} packetLoss     - потери пакетов % (0–10)
     * @param {number} timeOfDay      - час суток (0–23) или уже нормализованный (0–1)
     * @param {number} connectionType - wifi=1, cellular=0, unknown=0.5
     * @returns {number[]}
     */
    normalizeInput(speed, rtt, jitter, packetLoss, timeOfDay, connectionType) {
        return [
            Math.min(speed / 200, 1),
            Math.min(rtt   / 500, 1),
            Math.min(jitter / 100, 1),
            Math.min(packetLoss / 10, 1),
            // Если timeOfDay уже в [0,1] — оставляем как есть; иначе нормализуем
            timeOfDay > 1 ? timeOfDay / 24 : timeOfDay,
            Math.min(Math.max(connectionType, 0), 1)
        ];
    }

    /**
     * Подготовка входного вектора из объекта метрик.
     * @param {{ speed, rtt, jitter, packetLoss, timeOfDay, connectionType }} metrics
     * @returns {number[]}
     */
    prepareInput(metrics) {
        return this.normalizeInput(
            metrics.speed          || 0,
            metrics.rtt            || 0,
            metrics.jitter         || 0,
            metrics.packetLoss     || 0,
            metrics.timeOfDay      !== undefined ? metrics.timeOfDay : new Date().getHours() / 24,
            metrics.connectionType !== undefined ? metrics.connectionType : 0.5
        );
    }

    // ─── Анализ текущего состояния сети ──────────────────────────────────────

    /**
     * Выполнить анализ метрик через нейронную сеть.
     * @param {{ speed, rtt, jitter, packetLoss, timeOfDay, connectionType }} metrics
     * @returns {{ quality, confidence, distribution, recommendations }}
     */
    analyze(metrics) {
        try {
            const input  = this.prepareInput(metrics);
            const output = this.network.predict(input);
            return this.interpretOutput(output);
        } catch (e) {
            console.error('[AI] Ошибка анализа:', e);
            return null;
        }
    }

    // ─── Интерпретация выхода нейросети ──────────────────────────────────────

    /**
     * Преобразование выходного вектора в понятный результат.
     * @param {number[]} output - [excellent, good, fair, poor]
     * @returns {{ quality: string, confidence: number, distribution: object, recommendations: string[] }}
     */
    interpretOutput(output) {
        const labels   = ['Отличное', 'Хорошее', 'Среднее', 'Плохое'];
        const maxVal   = Math.max(...output);
        const maxIndex = output.indexOf(maxVal);

        return {
            quality:    labels[maxIndex],
            confidence: maxVal * 100,
            distribution: {
                excellent: output[0] * 100,
                good:      output[1] * 100,
                fair:      output[2] * 100,
                poor:      output[3] * 100
            },
            recommendations: this.generateRecommendations(output)
        };
    }

    // ─── Генерация рекомендаций ───────────────────────────────────────────────

    /**
     * Генерирует текстовые рекомендации на основе результата классификации.
     * @param {number[]} output
     * @returns {string[]}
     */
    generateRecommendations(output) {
        const recommendations = [];
        const quality = output.indexOf(Math.max(...output));

        if (quality === 2 || quality === 3) {
            recommendations.push('Попробуйте переместиться ближе к роутеру');
            recommendations.push('Проверьте количество подключенных устройств');
            recommendations.push('Перезагрузите роутер');
        }

        if (quality === 3) {
            recommendations.push('Проверьте физическое состояние кабелей и оборудования');
            recommendations.push('Свяжитесь с провайдером, если проблема не устраняется');
        }

        return recommendations;
    }

    // ─── Обучение на новых данных ─────────────────────────────────────────────

    /**
     * Добавить новый обучающий пример и переобучить модель при накоплении 10 примеров.
     * @param {{ speed, rtt, jitter, packetLoss, timeOfDay, connectionType }} metrics
     * @param {number[]} userFeedback - one-hot вектор: [1,0,0,0] / [0,1,0,0] / ...
     */
    learn(metrics, userFeedback) {
        const input = this.prepareInput(metrics);
        this.trainingHistory.push({ input, output: userFeedback });

        // Переобучаем при каждых 10 новых примерах
        if (this.trainingHistory.length >= 10 && this.trainingHistory.length % 10 === 0) {
            this.retrain();
        }
    }

    // ─── Переобучение модели ──────────────────────────────────────────────────

    /**
     * Переобучить модель на всей истории обучения.
     * @returns {{ finalLoss: number, accuracy: number, lossHistory: number[] }}
     */
    retrain() {
        if (this.trainingHistory.length === 0) {
            return { finalLoss: 0, accuracy: 0, lossHistory: [] };
        }

        const result = this.network.train(this.trainingHistory, 100, 0.01);
        this.lastTrainedTime = new Date().toLocaleString('ru-RU');
        this.modelAccuracy   = result.accuracy;
        this.saveModel();
        return result;
    }

    // ─── Сохранение / Загрузка модели ────────────────────────────────────────

    /**
     * Сохранить модель в localStorage.
     */
    saveModel() {
        try {
            localStorage.setItem('wifiAiModel', JSON.stringify({
                weights:         this.network.getWeights(),
                trainingHistory: this.trainingHistory,
                lastTrainedTime: this.lastTrainedTime,
                modelAccuracy:   this.modelAccuracy
            }));
        } catch (e) {
            console.warn('[AI] Не удалось сохранить модель:', e);
        }
    }

    /**
     * Загрузить модель из localStorage.
     * Если модели нет — запустить предобучение на синтетических данных.
     */
    loadModel() {
        try {
            const saved = localStorage.getItem('wifiAiModel');
            if (saved) {
                const data = JSON.parse(saved);
                this.network.setWeights(data.weights);
                this.trainingHistory = data.trainingHistory || [];
                this.lastTrainedTime = data.lastTrainedTime || null;
                this.modelAccuracy   = data.modelAccuracy   || 0;
            } else {
                this.pretrainModel();
            }
        } catch (e) {
            console.warn('[AI] Не удалось загрузить модель, запуск предобучения:', e);
            this.pretrainModel();
        }
    }

    // ─── Предобучение на синтетических данных ────────────────────────────────

    /**
     * Предобучение на базовом синтетическом датасете.
     * Данные уже нормализованы в [0, 1].
     *
     * Входной формат: [speed/200, rtt/500, jitter/100, packetLoss/10, timeOfDay/24, connType]
     */
    pretrainModel() {
        const baseDataset = [
            // Отличное соединение (speed высокий, rtt низкий, jitter минимальный, 0 потерь)
            { input: [0.475, 0.020, 0.020, 0.000, 0.50, 1.0], output: [1, 0, 0, 0] },
            { input: [0.600, 0.016, 0.010, 0.000, 0.30, 1.0], output: [1, 0, 0, 0] },
            { input: [0.800, 0.010, 0.005, 0.000, 0.60, 1.0], output: [1, 0, 0, 0] },
            { input: [0.500, 0.024, 0.015, 0.000, 0.45, 1.0], output: [1, 0, 0, 0] },

            // Хорошее соединение
            { input: [0.250, 0.060, 0.050, 0.010, 0.50, 1.0], output: [0, 1, 0, 0] },
            { input: [0.300, 0.050, 0.080, 0.020, 0.70, 1.0], output: [0, 1, 0, 0] },
            { input: [0.200, 0.070, 0.060, 0.015, 0.40, 0.5], output: [0, 1, 0, 0] },
            { input: [0.350, 0.040, 0.040, 0.010, 0.55, 1.0], output: [0, 1, 0, 0] },

            // Среднее соединение
            { input: [0.100, 0.160, 0.150, 0.100, 0.40, 0.0], output: [0, 0, 1, 0] },
            { input: [0.075, 0.200, 0.200, 0.200, 0.80, 0.0], output: [0, 0, 1, 0] },
            { input: [0.120, 0.140, 0.120, 0.080, 0.50, 0.5], output: [0, 0, 1, 0] },
            { input: [0.080, 0.180, 0.170, 0.150, 0.35, 0.0], output: [0, 0, 1, 0] },

            // Плохое соединение
            { input: [0.025, 0.400, 0.500, 0.500, 0.60, 0.0], output: [0, 0, 0, 1] },
            { input: [0.015, 0.600, 0.800, 1.000, 0.90, 0.0], output: [0, 0, 0, 1] },
            { input: [0.030, 0.350, 0.450, 0.400, 0.55, 0.0], output: [0, 0, 0, 1] },
            { input: [0.010, 0.700, 0.900, 0.800, 0.75, 0.0], output: [0, 0, 0, 1] }
        ];

        const result = this.network.train(baseDataset, 200, 0.01);
        this.lastTrainedTime = new Date().toLocaleString('ru-RU');
        this.modelAccuracy   = result.accuracy;
        this.saveModel();
    }

    // ─── Вычисление точности ──────────────────────────────────────────────────

    /**
     * Вычислить точность модели на истории обучения.
     * @returns {number} точность в процентах
     */
    calculateAccuracy() {
        if (this.trainingHistory.length === 0) return this.modelAccuracy;

        let correct = 0;
        for (const sample of this.trainingHistory) {
            const prediction = this.network.predict(sample.input);
            const predIndex  = prediction.indexOf(Math.max(...prediction));
            const targIndex  = sample.output.indexOf(Math.max(...sample.output));
            if (predIndex === targIndex) correct++;
        }

        return (correct / this.trainingHistory.length) * 100;
    }

    /**
     * Получить время последнего обучения.
     * @returns {string|null}
     */
    getLastTrainingTime() {
        return this.lastTrainedTime;
    }

    // ─── Статистика модели ────────────────────────────────────────────────────

    /**
     * Получить статистику текущей модели.
     * @returns {{ trainingSamples: number, accuracy: number, lastTrained: string|null }}
     */
    getModelStats() {
        return {
            trainingSamples: this.trainingHistory.length,
            accuracy:        this.calculateAccuracy(),
            lastTrained:     this.lastTrainedTime
        };
    }

    // ─── Экспорт модели ───────────────────────────────────────────────────────

    /**
     * Экспортировать модель в JSON-строку.
     * @returns {string}
     */
    exportModel() {
        const data = {
            architecture:    '6-8-6-4',
            weights:         this.network.getWeights(),
            trainingHistory: this.trainingHistory,
            modelAccuracy:   this.modelAccuracy,
            timestamp:       new Date().toISOString()
        };
        return JSON.stringify(data, null, 2);
    }
}
