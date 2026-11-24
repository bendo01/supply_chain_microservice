const pool = require('../config/db');

function dateFilters(alias, { from, to, retailId }, params) {
  const where = [`${alias}.status = 'COMPLETED'`];
  if (retailId) { where.push(`${alias}.retail_id = ?`); params.push(retailId); }
  if (from) { where.push(`${alias}.created_at >= ?`); params.push(from); }
  if (to) { where.push(`${alias}.created_at <= ?`); params.push(to); }
  return where.join(' AND ');
}

async function getOverview({ retailId, from, to } = {}) {
  const params = [];
  const where = dateFilters('s', { retailId, from, to }, params);

  const [totals] = await pool.query(
    `SELECT
       COUNT(*) AS transaction_count,
       COALESCE(SUM(s.total), 0) AS revenue,
       COALESCE(AVG(s.total), 0) AS avg_transaction
     FROM sales s WHERE ${where}`,
    params
  );

  const params2 = [];
  const where2 = dateFilters('s', { retailId, from, to }, params2);
  const [profitRows] = await pool.query(
    `SELECT
       COALESCE(SUM(si.unit_cost * si.quantity), 0) AS cogs,
       COALESCE(SUM((si.unit_price - si.unit_cost) * si.quantity), 0) AS profit,
       COALESCE(SUM(si.quantity), 0) AS items_sold
     FROM sales s
     JOIN sale_items si ON si.sale_id = s.id
     WHERE ${where2}`,
    params2
  );

  const [daily] = await pool.query(
    `SELECT DATE(s.created_at) AS day,
            COUNT(*) AS transactions,
            COALESCE(SUM(s.total), 0) AS revenue
     FROM sales s WHERE ${where}
     GROUP BY DATE(s.created_at)
     ORDER BY day DESC
     LIMIT 30`,
    params.slice() // reuse same filters; params array was consumed in order but same values
  );

  const [lowStocksParams] = [retailId ? [retailId] : []];
  let lowSql = `
    SELECT rs.retail_id, r.name AS retail_name, rs.commodity_id, c.name AS commodity_name,
           rs.quantity, rs.min_stock, (rs.quantity - rs.reserved) AS available
    FROM retail_stocks rs
    JOIN retails r ON r.id = rs.retail_id
    JOIN commodities c ON c.id = rs.commodity_id
    WHERE rs.quantity <= rs.min_stock
  `;
  const lowArgs = [];
  if (retailId) { lowSql += ' AND rs.retail_id = ?'; lowArgs.push(retailId); }
  lowSql += ' ORDER BY (rs.quantity - rs.min_stock) ASC, c.name LIMIT 20';
  const [lowStocks] = await pool.query(lowSql, lowArgs);

  return {
    filters: { retail_id: retailId || null, from: from || null, to: to || null },
    summary: {
      transaction_count: Number(totals[0].transaction_count || 0),
      revenue: Number(totals[0].revenue || 0),
      average_transaction: Number(totals[0].avg_transaction || 0),
      cogs: Number(profitRows[0].cogs || 0),
      profit: Number(profitRows[0].profit || 0),
      items_sold: Number(profitRows[0].items_sold || 0)
    },
    daily,
    low_stocks: lowStocks
  };
}

async function getProfitByRetail({ from, to } = {}) {
  const params = [];
  const conditions = ["s.status = 'COMPLETED'"];
  if (from) { conditions.push('s.created_at >= ?'); params.push(from); }
  if (to) { conditions.push('s.created_at <= ?'); params.push(to); }
  const where = conditions.join(' AND ');
  const [rows] = await pool.query(
    `SELECT s.retail_id, r.code, r.name AS retail_name,
            COUNT(DISTINCT s.id) AS transaction_count,
            COALESCE(SUM(si.line_total), 0) AS revenue,
            COALESCE(SUM(si.unit_cost * si.quantity), 0) AS cogs,
            COALESCE(SUM((si.unit_price - si.unit_cost) * si.quantity), 0) AS profit
     FROM sales s
     JOIN retails r ON r.id = s.retail_id
     JOIN sale_items si ON si.sale_id = s.id
     WHERE ${where}
     GROUP BY s.retail_id, r.code, r.name
     ORDER BY profit DESC`,
    params
  );
  return rows;
}

async function getItemAnalysis({ retailId, from, to, limit = 20 } = {}) {
  const params = [];
  const conditions = ["s.status = 'COMPLETED'"];
  if (retailId) { conditions.push('s.retail_id = ?'); params.push(retailId); }
  if (from) { conditions.push('s.created_at >= ?'); params.push(from); }
  if (to) { conditions.push('s.created_at <= ?'); params.push(to); }
  const where = conditions.join(' AND ');
  const lim = Math.min(Number(limit) || 20, 100);
  const [rows] = await pool.query(
    `SELECT si.commodity_id, si.sku, si.name,
            SUM(si.quantity) AS qty_sold,
            SUM(si.line_total) AS revenue,
            SUM(si.unit_cost * si.quantity) AS cogs,
            SUM((si.unit_price - si.unit_cost) * si.quantity) AS profit
     FROM sales s
     JOIN sale_items si ON si.sale_id = s.id
     WHERE ${where}
     GROUP BY si.commodity_id, si.sku, si.name
     ORDER BY qty_sold DESC
     LIMIT ?`,
    [...params, lim]
  );
  return rows;
}

module.exports = { getOverview, getProfitByRetail, getItemAnalysis };
