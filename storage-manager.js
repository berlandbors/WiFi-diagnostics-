/**
 * storage-manager.js
 * Умная система управления базой данных измерений WiFi.
 * Защита от переполнения памяти, агрегация, FIFO-очистка.
 *
 * Лимиты: 1000 записей / 5 МБ
 * Уровни защиты: 70% → предупреждение, 80% → агрегация,
 *                90% → очистка, 95% → экстренная очистка
 */

'use strict';

class SmartStorageManager {
    constructor() {
        // Максимальные ограничения
        this.MAX_RECORDS = 1000;
        this.MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 МБ

        // Пороги переполнения (доля от MAX_RECORDS)
        this.THRESHOLD_WARN     = 0.70;
        this.THRESHOLD_AGGREGATE = 0.80;
        this.THRESHOLD_CLEANUP  = 0.90;
        this.THRESHOLD_EMERGENCY = 0.95;

        // Количество дней до агрегации
        this.AGGREGATE_DAYS = 7;

        // Основное хранилище
        this.db = [];

        // Статус последней операции
        this.lastOperation = null;

        // Загружаем данные из localStorage
        this._load();
    }

    // ─── Публичный API ──────────────────────────────────────────────────────

    /**
     * Добавление новой записи в базу данных.
     * @param {object} record - запись измерения
     * @returns {object} добавленная запись (с присвоенным id)
     */
    addRecord(record) {
        // Генерируем уникальный ID
        const entry = {
            id:             this._generateId(),
            timestamp:      record.timestamp || Date.now(),
            speed:          record.speed          || 0,
            rtt:            record.rtt            || 0,
            jitter:         record.jitter         || 0,
            packetLoss:     record.packetLoss      || 0,
            quality:        record.quality        || 'Среднее',
            hour:           record.hour           !== undefined ? record.hour : new Date().getHours(),
            dayOfWeek:      record.dayOfWeek      !== undefined ? record.dayOfWeek : new Date().getDay(),
            connectionType: record.connectionType || 'wifi',
            isAnomalous:    record.isAnomalous    || false,
            aggregated:     false
        };

        this.db.push(entry);

        // Проверяем уровень заполненности и применяем защиту
        this._checkAndProtect();

        // Сохраняем в localStorage
        this._save();

        return entry;
    }

    /**
     * Получение всех записей (не агрегированных).
     * @returns {object[]}
     */
    getRecords() {
        return this.db.filter(r => !r.aggregated);
    }

    /**
     * Получение статуса базы данных.
     * @returns {object}
     */
    getStatus() {
        const total      = this.db.length;
        const fillPercent = Math.round((total / this.MAX_RECORDS) * 100);
        const sizeBytes  = this._estimateSizeBytes();
        const sizeFill   = Math.round((sizeBytes / this.MAX_SIZE_BYTES) * 100);

        let level = 'ok';
        if (fillPercent >= 95) level = 'critical';
        else if (fillPercent >= 90) level = 'danger';
        else if (fillPercent >= 80) level = 'warning';
        else if (fillPercent >= 70) level = 'notice';

        return {
            total,
            maxRecords:   this.MAX_RECORDS,
            fillPercent,
            sizeBytes,
            maxSizeBytes: this.MAX_SIZE_BYTES,
            sizeFill,
            level,
            lastOperation: this.lastOperation
        };
    }

    /**
     * Ручная оптимизация базы данных.
     * @returns {object} отчёт об оптимизации
     */
    optimize() {
        const before = this.db.length;
        this._removeDuplicates();
        this._aggregateOldData();
        const after = this.db.length;
        this._save();
        const report = { removed: before - after, remaining: after };
        this.lastOperation = `Оптимизация: удалено ${report.removed} записей`;
        return report;
    }

    /**
     * Экспорт данных в JSON-строку.
     * @returns {string}
     */
    exportData() {
        return JSON.stringify({
            version:    2,
            exportDate: new Date().toISOString(),
            records:    this.db
        }, null, 2);
    }

    /**
     * Импорт данных из JSON-строки.
     * @param {string} jsonStr
     * @returns {boolean} успех
     */
    importData(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            if (!Array.isArray(data.records)) throw new Error('Неверный формат');
            this.db = data.records.slice(0, this.MAX_RECORDS);
            this._save();
            this.lastOperation = `Импорт: загружено ${this.db.length} записей`;
            return true;
        } catch (e) {
            console.error('[Storage] Ошибка импорта:', e);
            return false;
        }
    }

    /**
     * Полная очистка базы данных.
     */
    clear() {
        this.db = [];
        this._save();
        this.lastOperation = 'База данных очищена';
    }

    /**
     * Получение записей за последние N часов.
     * @param {number} hours
     * @returns {object[]}
     */
    getRecentRecords(hours = 24) {
        const cutoff = Date.now() - hours * 60 * 60 * 1000;
        return this.db.filter(r => r.timestamp >= cutoff && !r.aggregated);
    }

    // ─── Внутренние методы защиты ───────────────────────────────────────────

    /**
     * Проверка уровня заполненности и применение соответствующей защиты.
     */
    _checkAndProtect() {
        const ratio = this.db.length / this.MAX_RECORDS;

        if (ratio >= this.THRESHOLD_EMERGENCY) {
            // 95%+ → экстренная FIFO-очистка (удаляем 30% старых записей)
            this._fifoCleanup(0.30);
            this.lastOperation = '[CRIT] Экстренная очистка БД (95%)';
            console.warn('[Storage] Экстренная очистка при 95% заполнении');
        } else if (ratio >= this.THRESHOLD_CLEANUP) {
            // 90%+ → полная агрегация + очистка дубликатов
            this._removeDuplicates();
            this._aggregateOldData();
            this.lastOperation = '[WARN] Автоочистка БД (90%)';
        } else if (ratio >= this.THRESHOLD_AGGREGATE) {
            // 80%+ → агрегация старых данных
            this._aggregateOldData();
            this.lastOperation = '[INFO] Агрегация старых данных (80%)';
        } else if (ratio >= this.THRESHOLD_WARN) {
            // 70%+ → только предупреждение
            this.lastOperation = '[NOTICE] БД заполнена на 70%';
        }
    }

    /**
     * Удаление дубликатов (записи с разницей < 5 секунд).
     */
    _removeDuplicates() {
        const before = this.db.length;
        const sorted = [...this.db].sort((a, b) => a.timestamp - b.timestamp);
        if (!sorted.length) return;
        const result = [sorted[0]];

        for (let i = 1; i < sorted.length; i++) {
            const prev = result[result.length - 1];
            const curr = sorted[i];
            // Пропускаем запись если она дублирует предыдущую
            if (curr.timestamp - prev.timestamp < 5000 &&
                Math.abs(curr.speed - prev.speed) < 0.1) {
                continue;
            }
            result.push(curr);
        }

        this.db = result;
        const removed = before - this.db.length;
        if (removed > 0) {
            console.log(`[Storage] Удалено дубликатов: ${removed}`);
        }
    }

    /**
     * Агрегация данных старше AGGREGATE_DAYS дней в почасовые средние.
     */
    _aggregateOldData() {
        const cutoff = Date.now() - this.AGGREGATE_DAYS * 24 * 60 * 60 * 1000;

        // Разделяем записи на старые (для агрегации) и свежие
        const oldRecords   = this.db.filter(r => r.timestamp < cutoff && !r.aggregated);
        const freshRecords = this.db.filter(r => r.timestamp >= cutoff || r.aggregated);

        if (oldRecords.length < 2) return;

        // Группируем старые записи по дню и часу
        const groups = {};
        for (const r of oldRecords) {
            const d   = new Date(r.timestamp);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
            if (!groups[key]) {
                groups[key] = { records: [], hour: d.getHours(), dayOfWeek: d.getDay(), timestamp: r.timestamp };
            }
            groups[key].records.push(r);
        }

        // Создаём агрегированные записи
        const aggregated = Object.values(groups).map(g => ({
            id:             this._generateId(),
            timestamp:      g.timestamp,
            speed:          g.records.reduce((s, r) => s + r.speed,          0) / g.records.length,
            rtt:            g.records.reduce((s, r) => s + r.rtt,            0) / g.records.length,
            jitter:         g.records.reduce((s, r) => s + r.jitter,         0) / g.records.length,
            packetLoss:     g.records.reduce((s, r) => s + r.packetLoss,     0) / g.records.length,
            quality:        this._mostCommonQuality(g.records),
            hour:           g.hour,
            dayOfWeek:      g.dayOfWeek,
            connectionType: g.records[0].connectionType || 'wifi',
            isAnomalous:    false,
            aggregated:     true,
            count:          g.records.length
        }));

        this.db = [...aggregated, ...freshRecords];
        console.log(`[Storage] Агрегировано ${oldRecords.length} записей в ${aggregated.length} часовых блоков`);
    }

    /**
     * FIFO-очистка: удаление доли самых старых записей.
     * @param {number} fraction - доля удаляемых записей (0–1)
     */
    _fifoCleanup(fraction) {
        const toRemove = Math.ceil(this.db.length * fraction);
        // Сортируем по времени и удаляем самые старые
        this.db.sort((a, b) => a.timestamp - b.timestamp);
        this.db = this.db.slice(toRemove);
        console.log(`[Storage] FIFO-очистка: удалено ${toRemove} записей`);
    }

    // ─── Вспомогательные методы ─────────────────────────────────────────────

    /**
     * Определяет наиболее часто встречающееся качество в массиве записей.
     * @param {object[]} records
     * @returns {string}
     */
    _mostCommonQuality(records) {
        const counts = {};
        for (const r of records) {
            counts[r.quality] = (counts[r.quality] || 0) + 1;
        }
        return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 'Среднее');
    }

    /**
     * Оценка размера данных в байтах.
     * @returns {number}
     */
    _estimateSizeBytes() {
        try {
            return new Blob([JSON.stringify(this.db)]).size;
        } catch (e) {
            // Грубая оценка: ~200 байт на запись
            return this.db.length * 200;
        }
    }

    /** Генерация уникального ID */
    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    /** Сохранение в localStorage */
    _save() {
        try {
            localStorage.setItem('wifi_db', JSON.stringify(this.db));
        } catch (e) {
            // Если localStorage переполнен — применяем экстренную очистку
            console.warn('[Storage] localStorage переполнен, применяем FIFO-очистку');
            this._fifoCleanup(0.50);
            try {
                localStorage.setItem('wifi_db', JSON.stringify(this.db));
            } catch (e2) {
                console.error('[Storage] Не удалось сохранить данные:', e2);
            }
        }
    }

    /** Загрузка из localStorage */
    _load() {
        try {
            const raw = localStorage.getItem('wifi_db');
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                this.db = parsed.slice(0, this.MAX_RECORDS);
            }
        } catch (e) {
            console.warn('[Storage] Не удалось загрузить данные:', e);
            this.db = [];
        }
    }
}
