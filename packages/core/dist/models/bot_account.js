"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotAccountModel = void 0;
const base_model_1 = require("./base.model");
class BotAccountModel extends base_model_1.BaseModel {
    static tableName = 'bot_accounts';
    // override idColumn = 'id'; // if different
    // override softDelete = true; // default true
    // override timestamps = true; // default true
    static async getIdleBot() {
        const row = await this.qb()
            .modify(qb => { if (this.softDelete)
            qb.whereNull('deleted_at'); })
            .where({ status: 'active' })
            // Use a bound value for portability; ISO string sorts correctly in SQLite/Postgres
            .orderByRaw(`COALESCE(last_used, 0) ASC`).orderBy('created_at', 'asc').first();
        return row;
    }
}
exports.BotAccountModel = BotAccountModel;
