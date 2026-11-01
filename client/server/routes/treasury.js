import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { pushToSupabase, deleteFromSupabase, pushBatchToSupabase, getLiveSyncStatus, syncDatabase } from '../supabaseSync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function calcDenomTotal(body) {
  if (!body) return 0;
  const p200 = parseInt(body.packs_200 || 0, 10);
  const l200 = parseInt(body.loose_200 !== undefined && body.loose_200 !== '' ? body.loose_200 : (body.count_200 || 0), 10);
  const c200 = (p200 * 100) + l200;

  const p100 = parseInt(body.packs_100 || 0, 10);
  const l100 = parseInt(body.loose_100 !== undefined && body.loose_100 !== '' ? body.loose_100 : (body.count_100 || 0), 10);
  const c100 = (p100 * 100) + l100;

  const p50 = parseInt(body.packs_50 || 0, 10);
  const l50 = parseInt(body.loose_50 !== undefined && body.loose_50 !== '' ? body.loose_50 : (body.count_50 || 0), 10);
  const c50 = (p50 * 100) + l50;

  const p20 = parseInt(body.packs_20 || 0, 10);
  const l20 = parseInt(body.loose_20 !== undefined && body.loose_20 !== '' ? body.loose_20 : (body.count_20 || 0), 10);
  const c20 = (p20 * 100) + l20;

  const p10 = parseInt(body.packs_10 || 0, 10);
  const l10 = parseInt(body.loose_10 !== undefined && body.loose_10 !== '' ? body.loose_10 : (body.count_10 || 0), 10);
  const c10 = (p10 * 100) + l10;

  const p5 = parseInt(body.packs_5 || 0, 10);
  const l5 = parseInt(body.loose_5 !== undefined && body.loose_5 !== '' ? body.loose_5 : (body.count_5 || 0), 10);
  const c5 = (p5 * 100) + l5;

  return (
    (c200 * 200) +
    (c100 * 100) +
    (c50  * 50)  +
    (c20  * 20)  +
    (c10  * 10)  +
    (c5   * 5)
  );
}

// ─── SAFES ────────────────────────────────────────────────────────────────────

// GET /api/treasury/safes
router.get('/safes', (req, res) => {
  try {
    const safes = db.prepare(`
      SELECT s.*,
             e.name as custodian_employee_name,
             p.name as parent_safe_name
      FROM cash_safes s
      LEFT JOIN employees e ON e.id = s.custodian_employee_id
      LEFT JOIN cash_safes p ON p.id = s.parent_safe_id
      ORDER BY s.type DESC, s.id ASC
    `).all();
    res.json({ success: true, data: safes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/treasury/safes
router.post('/safes', async (req, res) => {
  try {
    const { name, type, parent_safe_id, custodian_name, custodian_phone,
            custodian_employee_id, notes, is_trust, safe_category } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'اسم الخزينة والنوع مطلوبان' });

    // Sub safe must have a parent
    if (type === 'sub' && !parent_safe_id) {
      return res.status(400).json({ error: 'الخزينة الفرعية يجب أن تتبع خزينة رئيسية' });
    }

    const result = db.prepare(`
      INSERT INTO cash_safes (name, type, parent_safe_id, custodian_name, custodian_phone,
                              custodian_employee_id, current_balance, notes, is_trust, safe_category)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(name.trim(), type, parent_safe_id || null, custodian_name || null,
           custodian_phone || null, custodian_employee_id || null, notes || null,
           is_trust ? 1 : 0, safe_category || (is_trust ? 'trust' : 'standard'));

    const safe = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(result.lastInsertRowid);
    await pushToSupabase('cash_safes', safe);
    res.status(201).json({ success: true, data: safe });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/treasury/safes/:id
router.put('/safes/:id', async (req, res) => {
  try {
    const { name, custodian_name, custodian_phone, custodian_employee_id, notes, is_active, is_trust, safe_category } = req.body;
    const existing = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'الخزينة غير موجودة' });

    db.prepare(`
      UPDATE cash_safes SET
        name = COALESCE(?, name),
        custodian_name = COALESCE(?, custodian_name),
        custodian_phone = COALESCE(?, custodian_phone),
        custodian_employee_id = COALESCE(?, custodian_employee_id),
        notes = COALESCE(?, notes),
        is_active = COALESCE(?, is_active),
        is_trust = COALESCE(?, is_trust),
        safe_category = COALESCE(?, safe_category)
      WHERE id = ?
    `).run(name || null, custodian_name || null, custodian_phone || null,
           custodian_employee_id || null, notes || null,
           is_active !== undefined ? is_active : null,
           is_trust !== undefined ? (is_trust ? 1 : 0) : null,
           safe_category || null,
           req.params.id);

    const updated = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(req.params.id);
    await pushToSupabase('cash_safes', updated);
    res.json({ success: true, data: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PARTIES / EXTERNAL VENDORS & SUPPLIERS ─────────────────────────────────

// GET /api/treasury/parties
router.get('/parties', (req, res) => {
  try {
    const parties = db.prepare(`
      SELECT p.*,
             COALESCE(SUM(CASE WHEN t.type IN ('expense', 'custody_return') THEN t.amount ELSE 0 END), 0) as total_spent,
             COUNT(t.id) as tx_count,
             MAX(t.transaction_date) as last_transaction_date
      FROM treasury_parties p
      LEFT JOIN cash_transactions t ON t.party_id = p.id
      WHERE p.is_active = 1
      GROUP BY p.id
      ORDER BY p.name ASC
    `).all();
    res.json({ success: true, data: parties });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/treasury/parties
router.post('/parties', async (req, res) => {
  try {
    const { name, party_type, category, contact_person, phone, tax_no, address, notes } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'اسم الجهة أو الشركة مطلوب' });

    const existing = db.prepare('SELECT id FROM treasury_parties WHERE name = ?').get(name.trim());
    if (existing) {
      return res.status(400).json({ error: 'الجهة مسجلة بالفعل بهذا الاسم' });
    }

    const result = db.prepare(`
      INSERT INTO treasury_parties (name, party_type, category, contact_person, phone, tax_no, address, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      party_type || 'company',
      category || 'أخرى',
      contact_person || null,
      phone || null,
      tax_no || null,
      address || null,
      notes || null
    );

    const party = db.prepare('SELECT * FROM treasury_parties WHERE id = ?').get(result.lastInsertRowid);
    await pushToSupabase('treasury_parties', party);
    res.status(201).json({ success: true, data: party, message: 'تم تكويد الجهة / الشركة بنجاح' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/treasury/parties/:id
router.put('/parties/:id', async (req, res) => {
  try {
    const { name, party_type, category, contact_person, phone, tax_no, address, notes, is_active } = req.body;
    const existing = db.prepare('SELECT * FROM treasury_parties WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'الجهة غير موجودة' });

    db.prepare(`
      UPDATE treasury_parties SET
        name = COALESCE(?, name),
        party_type = COALESCE(?, party_type),
        category = COALESCE(?, category),
        contact_person = COALESCE(?, contact_person),
        phone = COALESCE(?, phone),
        tax_no = COALESCE(?, tax_no),
        address = COALESCE(?, address),
        notes = COALESCE(?, notes),
        is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(
      name?.trim() || null, party_type || null, category || null, contact_person || null,
      phone || null, tax_no || null, address || null, notes || null,
      is_active !== undefined ? is_active : null, req.params.id
    );

    const updated = db.prepare('SELECT * FROM treasury_parties WHERE id = ?').get(req.params.id);
    await pushToSupabase('treasury_parties', updated);
    res.json({ success: true, data: updated, message: 'تم تحديث بيانات الجهة بنجاح' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/treasury/parties/:id
router.delete('/parties/:id', async (req, res) => {
  try {
    const txCount = db.prepare('SELECT COUNT(*) as c FROM cash_transactions WHERE party_id = ?').get(req.params.id).c;
    if (txCount > 0) {
      db.prepare('UPDATE treasury_parties SET is_active = 0 WHERE id = ?').run(req.params.id);
      const updated = db.prepare('SELECT * FROM treasury_parties WHERE id = ?').get(req.params.id);
      await pushToSupabase('treasury_parties', updated);
      return res.json({ success: true, message: 'تم أرشفة وتعطيل الجهة لوجود حركات مالية مسجلة عليها' });
    }
    db.prepare('DELETE FROM treasury_parties WHERE id = ?').run(req.params.id);
    await deleteFromSupabase('treasury_parties', req.params.id);
    res.json({ success: true, message: 'تم حذف الجهة بنجاح' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/treasury/parties/:id/statement — كشف حساب ومراجعة معاملات الجهة
router.get('/parties/:id/statement', (req, res) => {
  try {
    const party = db.prepare('SELECT * FROM treasury_parties WHERE id = ?').get(req.params.id);
    if (!party) return res.status(404).json({ error: 'الجهة غير موجودة' });

    const transactions = db.prepare(`
      SELECT t.*, s.name as safe_name
      FROM cash_transactions t
      LEFT JOIN cash_safes s ON s.id = t.safe_id
      WHERE t.party_id = ?
      ORDER BY t.transaction_date DESC, t.id DESC
    `).all(req.params.id);

    const totalSpent = transactions.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

    res.json({
      success: true,
      party,
      statement: {
        total_amount: totalSpent,
        transactions_count: transactions.length,
        transactions
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── RECEIPT NUMBER GENERATOR ────────────────────────────────────────────────
function getNextJ1ReceiptNo() {
  const rows = db.prepare(`SELECT reference_no FROM cash_transactions WHERE reference_no LIKE 'J1-%'`).all();
  let maxNum = 0;
  for (const r of rows) {
    const match = r.reference_no && r.reference_no.match(/^J1-(\d+)/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `J1-${String(maxNum + 1).padStart(3, '0')}`;
}

function getNextFarmReceiptNo() {
  const rows = db.prepare(`SELECT reference_no FROM cash_transactions WHERE reference_no LIKE 'M1-%'`).all();
  let maxNum = 0;
  for (const r of rows) {
    const match = r.reference_no && r.reference_no.match(/^M1-(\d+)/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `M1-${String(maxNum + 1).padStart(3, '0')}`;
}

// GET /api/treasury/next-receipt-no?prefix=J1
router.get('/next-receipt-no', (req, res) => {
  try {
    const prefix = req.query.prefix || 'J1';
    if (prefix === 'J1') {
      return res.json({ success: true, nextReceiptNo: getNextJ1ReceiptNo() });
    }
    if (prefix === 'M1') {
      return res.json({ success: true, nextReceiptNo: getNextFarmReceiptNo() });
    }
    const rows = db.prepare(`SELECT reference_no FROM cash_transactions WHERE reference_no LIKE ?`).all(`${prefix}-%`);
    let maxNum = 0;
    for (const r of rows) {
      const match = r.reference_no && r.reference_no.match(new RegExp(`^${prefix}-(\\d+)`));
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    res.json({ success: true, nextReceiptNo: `${prefix}-${String(maxNum + 1).padStart(3, '0')}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/treasury/upload-receipt — Save uploaded receipt photo (Base64)
router.post('/upload-receipt', (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'لم يتم إرسال بيانات الصورة' });

    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer;
    let ext = '.jpg';

    if (matches && matches.length === 3) {
      const mime = matches[1];
      if (mime.includes('png')) ext = '.png';
      else if (mime.includes('webp')) ext = '.webp';
      else if (mime.includes('pdf')) ext = '.pdf';
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(image, 'base64');
    }

    const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'treasury');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const uniqueName = `receipt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filePath = path.join(uploadDir, uniqueName);

    fs.writeFileSync(filePath, buffer);
    const publicUrl = `/uploads/treasury/${uniqueName}`;

    res.json({ success: true, url: publicUrl, filename: uniqueName });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'فشل حفظ الصورة: ' + err.message });
  }
});

// Helper: Apply delta transaction to drawer denominations (increment on receive, decrement on disburse)
// PHYSICAL CASH DRAWER STRICTLY BELONGS ONLY TO THE MAIN SAFE
function applyDrawerTransaction(safe_id, tx_id, tx_date, type, denomination, newSafeBalance, notes) {
  if (!denomination) return null;
  const safe = db.prepare('SELECT type FROM cash_safes WHERE id = ?').get(safe_id);
  if (!safe || safe.type !== 'main') return null; // Drawer belongs ONLY to the Main Safe!

  const isReceipt = ['custody_receive', 'income', 'transfer_in'].includes(type);
  const multiplier = isReceipt ? 1 : -1;
  const prev = db.prepare('SELECT * FROM cash_denominations WHERE safe_id = ? ORDER BY id DESC LIMIT 1').get(safe_id);

  const p200 = Math.max(0, (prev ? (prev.packs_200 || 0) : 0) + multiplier * parseInt(denomination.packs_200 || 0, 10));
  const l200 = Math.max(0, (prev ? (prev.loose_200 !== undefined ? prev.loose_200 : prev.count_200) || 0 : 0) + multiplier * parseInt(denomination.loose_200 || 0, 10));
  const c200 = (p200 * 100) + l200;

  const p100 = Math.max(0, (prev ? (prev.packs_100 || 0) : 0) + multiplier * parseInt(denomination.packs_100 || 0, 10));
  const l100 = Math.max(0, (prev ? (prev.loose_100 !== undefined ? prev.loose_100 : prev.count_100) || 0 : 0) + multiplier * parseInt(denomination.loose_100 || 0, 10));
  const c100 = (p100 * 100) + l100;

  const p50  = Math.max(0, (prev ? (prev.packs_50 || 0) : 0) + multiplier * parseInt(denomination.packs_50 || 0, 10));
  const l50  = Math.max(0, (prev ? (prev.loose_50 !== undefined ? prev.loose_50 : prev.count_50) || 0 : 0) + multiplier * parseInt(denomination.loose_50 || 0, 10));
  const c50  = (p50 * 100) + l50;

  const p20  = Math.max(0, (prev ? (prev.packs_20 || 0) : 0) + multiplier * parseInt(denomination.packs_20 || 0, 10));
  const l20  = Math.max(0, (prev ? (prev.loose_20 !== undefined ? prev.loose_20 : prev.count_20) || 0 : 0) + multiplier * parseInt(denomination.loose_20 || 0, 10));
  const c20  = (p20 * 100) + l20;

  const p10  = Math.max(0, (prev ? (prev.packs_10 || 0) : 0) + multiplier * parseInt(denomination.packs_10 || 0, 10));
  const l10  = Math.max(0, (prev ? (prev.loose_10 !== undefined ? prev.loose_10 : prev.count_10) || 0 : 0) + multiplier * parseInt(denomination.loose_10 || 0, 10));
  const c10  = (p10 * 100) + l10;

  const p5   = Math.max(0, (prev ? (prev.packs_5 || 0) : 0) + multiplier * parseInt(denomination.packs_5 || 0, 10));
  const l5   = Math.max(0, (prev ? (prev.loose_5 !== undefined ? prev.loose_5 : prev.count_5) || 0 : 0) + multiplier * parseInt(denomination.loose_5 || 0, 10));
  const c5   = (p5 * 100) + l5;

  let physicalTotal = (c200 * 200 + c100 * 100 + c50 * 50 + c20 * 20 + c10 * 10 + c5 * 5);

  if (!prev && !isReceipt) {
    physicalTotal = newSafeBalance;
  }

  const diff = physicalTotal - newSafeBalance;

  const denomRes = db.prepare(`
    INSERT INTO cash_denominations
      (safe_id, transaction_id, snapshot_date,
       count_200, count_100, count_50, count_20, count_10, count_5, count_1,
       count_50pt, count_25pt, count_10pt, count_5pt,
       packs_200, loose_200, packs_100, loose_100, packs_50, loose_50,
       packs_20, loose_20, packs_10, loose_10, packs_5, loose_5,
       tafqeet_text, total_physical, book_balance, difference, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    safe_id, tx_id, tx_date,
    c200, c100, c50, c20, c10, c5,
    0, 0, 0, 0, 0,
    p200, l200, p100, l100, p50, l50,
    p20, l20, p10, l10, p5, l5,
    null,
    physicalTotal, newSafeBalance, diff,
    notes || (isReceipt ? 'إيداع عهدة - زيادة درج الرئيسية' : 'صرف نقدية - إنقاص درج الرئيسية')
  );

  return denomRes.lastInsertRowid;
}

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

// GET /api/treasury/transactions?safe_id=&from=&to=&party_id=
router.get('/transactions', (req, res) => {
  try {
    const { safe_id, from, to, type, party_id, limit = 400 } = req.query;
    let q = `
      SELECT t.*,
             s.name as safe_name,
             rs.name as related_safe_name,
             e.name as employee_name_ref,
             p.name as linked_party_name
      FROM cash_transactions t
      LEFT JOIN cash_safes s ON s.id = t.safe_id
      LEFT JOIN cash_safes rs ON rs.id = t.related_safe_id
      LEFT JOIN employees e ON e.id = t.related_employee_id
      LEFT JOIN treasury_parties p ON p.id = t.party_id
      WHERE 1=1
    `;
    const params = [];
    if (safe_id)  { q += ' AND t.safe_id = ?'; params.push(safe_id); }
    if (from)     { q += ' AND t.transaction_date >= ?'; params.push(from); }
    if (to)       { q += ' AND t.transaction_date <= ?'; params.push(to); }
    if (type)     { q += ' AND t.type = ?'; params.push(type); }
    if (party_id) { q += ' AND t.party_id = ?'; params.push(party_id); }
    q += ` ORDER BY t.transaction_date DESC, t.id DESC LIMIT ${parseInt(limit)}`;

    const rows = db.prepare(q).all(...params);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/treasury/transactions  — main transaction endpoint
router.post('/transactions', async (req, res) => {
  try {
    const {
      safe_id, type, amount, description, reference_no,
      related_employee_id, related_employee_name,
      related_safe_id, sender_phone, transaction_date, notes,
      recipient_type, party_id, party_name, category, invoice_no, packs_detail,
      receipt_image, cost_center, crop_type,
      denomination
    } = req.body;

    if (!safe_id || !type || !amount || !description || !transaction_date) {
      return res.status(400).json({ error: 'الحقول المطلوبة: safe_id, type, amount, description, transaction_date' });
    }

    const safe = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(safe_id);
    if (!safe) return res.status(404).json({ error: 'الخزينة غير موجودة' });

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'المبلغ يجب أن يكون رقماً موجباً' });

    // Validate denomination match if passed
    if (denomination) {
      const denomTotal = calcDenomTotal(denomination);
      if (Math.abs(denomTotal - amt) > 0.01) {
        return res.status(400).json({
          error: `إجمالي فئات النقدية والبواكي (${denomTotal.toLocaleString('ar-EG')} ج.م) لا يطابق مبلغ العملية (${amt.toLocaleString('ar-EG')} ج.م)`
        });
      }
    }

    // Determine party name if party_id provided
    let finalPartyId = party_id ? parseInt(party_id, 10) : null;
    let finalPartyName = party_name || null;
    if (finalPartyId && !finalPartyName) {
      const p = db.prepare('SELECT name FROM treasury_parties WHERE id = ?').get(finalPartyId);
      if (p) finalPartyName = p.name;
    }

    // Auto-generate J1 / M1 receipt numbers if not provided
    let finalRefNo = reference_no ? reference_no.trim() : null;
    if (type === 'farm_sale' && (!finalRefNo || !finalRefNo.startsWith('M1-'))) {
      finalRefNo = getNextFarmReceiptNo();
    } else if (safe.type === 'sub' && type === 'expense' && (!finalRefNo || !finalRefNo.startsWith('J1-'))) {
      finalRefNo = getNextJ1ReceiptNo();
    }

    // Determine if this is a debit (reduces balance) or credit
    const DEBIT_TYPES  = ['expense', 'transfer_out', 'salary_payment', 'custody_return', 'sub_replenish'];
    const CREDIT_TYPES = ['custody_receive', 'income', 'transfer_in', 'farm_sale'];

    let newBalance = safe.current_balance;
    if (DEBIT_TYPES.includes(type)) {
      if (amt > safe.current_balance) {
        return res.status(400).json({
          error: `الرصيد الحالي (${safe.current_balance.toLocaleString('ar-EG')} ج.م) لا يكفي لهذه العملية`
        });
      }
      newBalance = safe.current_balance - amt;
    } else if (CREDIT_TYPES.includes(type)) {
      newBalance = safe.current_balance + amt;
    }

    const txResult = db.transaction(() => {
      // Insert transaction
      const txStmt = db.prepare(`
        INSERT INTO cash_transactions
          (safe_id, type, amount, balance_before, balance_after, description, reference_no,
           related_employee_id, related_employee_name, related_safe_id,
           sender_phone, transaction_date, notes,
           recipient_type, party_id, party_name, category, invoice_no, packs_detail,
           receipt_image, cost_center, crop_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const txRes = txStmt.run(
        safe_id, type, amt, safe.current_balance, newBalance,
        description.trim(), finalRefNo || null,
        related_employee_id || null, related_employee_name || null,
        related_safe_id || null,
        sender_phone || null, transaction_date, notes || null,
        recipient_type || (finalPartyId ? 'party' : 'employee'),
        finalPartyId || null,
        finalPartyName || null,
        category || null,
        invoice_no || null,
        packs_detail ? (typeof packs_detail === 'object' ? JSON.stringify(packs_detail) : packs_detail) : null,
        receipt_image || null,
        cost_center || null,
        crop_type || null
      );

      // Update safe balance
      db.prepare('UPDATE cash_safes SET current_balance = ? WHERE id = ?')
        .run(newBalance, safe_id);

      // If transfer between safes: create mirror transaction on related safe
      if (type === 'transfer_out' && related_safe_id) {
        const relatedSafe = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(related_safe_id);
        if (relatedSafe) {
          const relBalance = relatedSafe.current_balance + amt;
          db.prepare(`
            INSERT INTO cash_transactions
              (safe_id, type, amount, balance_before, balance_after, description, reference_no,
               related_safe_id, transaction_date, notes)
            VALUES (?, 'transfer_in', ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(related_safe_id, amt, relatedSafe.current_balance, relBalance,
                 `تحويل وارد من: ${safe.name}`, finalRefNo || null,
                 safe_id, transaction_date, notes || null);
          db.prepare('UPDATE cash_safes SET current_balance = ? WHERE id = ?')
            .run(relBalance, related_safe_id);
        }
      }

      // Sub replenish (main sends to sub): mirror as transfer_in on sub safe
      if (type === 'sub_replenish' && related_safe_id) {
        const subSafe = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(related_safe_id);
        if (subSafe) {
          const subBalance = subSafe.current_balance + amt;
          db.prepare(`
            INSERT INTO cash_transactions
              (safe_id, type, amount, balance_before, balance_after, description,
               related_safe_id, transaction_date, notes)
            VALUES (?, 'transfer_in', ?, ?, ?, ?, ?, ?, ?)
          `).run(related_safe_id, amt, subSafe.current_balance, subBalance,
                 `عهدة واردة من: ${safe.name}`, safe_id, transaction_date, notes || null);
          db.prepare('UPDATE cash_safes SET current_balance = ? WHERE id = ?')
            .run(subBalance, related_safe_id);
        }
      }

      // Apply drawer denominations update (adds on receipt, subtracts on disburse)
      let denomId = null;
      if (denomination) {
        denomId = applyDrawerTransaction(
          safe_id,
          txRes.lastInsertRowid,
          transaction_date,
          type,
          denomination,
          newBalance,
          description.trim()
        );
      }

      return { txId: txRes.lastInsertRowid, denomId, newBalance, reference_no: finalRefNo };
    })();

    const tx = db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(txResult.txId);
    
    // Live push to Supabase
    await pushToSupabase('cash_transactions', tx);
    const safeUpdated = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(safe_id);
    if (safeUpdated) await pushToSupabase('cash_safes', safeUpdated);
    if (related_safe_id) {
      const relUpdated = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(related_safe_id);
      if (relUpdated) await pushToSupabase('cash_safes', relUpdated);
    }

    res.status(201).json({
      success: true,
      data: tx,
      newBalance: txResult.newBalance,
      denomId: txResult.denomId,
      reference_no: txResult.reference_no
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/treasury/disburse-employee — Single unified window for employee day 10 / 20 & loans
router.post('/disburse-employee', async (req, res) => {
  try {
    const {
      safe_id,
      employee_id,
      disbursement_type, // 'day_10' | 'day_20' | 'monthly_loan' | 'emergency_loan'
      amount,
      year,
      month,
      months_count, // for monthly_loan
      start_date,   // for monthly_loan ('YYYY-MM')
      courier_name,
      sender_phone,
      notes,
      denomination  // must match amount exactly!
    } = req.body;

    if (!safe_id || !employee_id || !disbursement_type || !amount) {
      return res.status(400).json({ error: 'البيانات غير مكتملة (safe_id, employee_id, disbursement_type, amount)' });
    }

    const safe = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(safe_id);
    if (!safe) return res.status(404).json({ error: 'الخزينة غير موجودة' });

    const emp = db.prepare('SELECT id, code, name FROM employees WHERE id = ?').get(employee_id);
    if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'المبلغ يجب أن يكون رقماً موجباً' });

    if (amt > safe.current_balance) {
      return res.status(400).json({
        error: `رصيد الخزينة (${safe.current_balance.toLocaleString('ar-EG')} ج.م) لا يكفي لصرف هذا المبلغ (${amt.toLocaleString('ar-EG')} ج.م)`
      });
    }

    // STRICT VALIDATION: Denominations must match amount!
    if (!denomination) {
      return res.status(400).json({ error: 'يجب إدخال فئات النقدية والبواكي المنصرفة من الدرج' });
    }
    const denomTotal = calcDenomTotal(denomination);
    if (Math.abs(denomTotal - amt) > 0.01) {
      return res.status(400).json({
        error: `إجمالي فئات النقدية والبواكي المنصرفة (${denomTotal.toLocaleString('ar-EG')} ج.م) لا يطابق مبلغ الصرف (${amt.toLocaleString('ar-EG')} ج.م)`
      });
    }

    const txDate = new Date().toISOString().split('T')[0];
    const newBalance = safe.current_balance - amt;

    const txResult = db.transaction(() => {
      let desc = '';
      let txType = 'expense';
      let loanId = null;

      if (disbursement_type === 'day_10' || disbursement_type === 'day_20') {
        const dayNum = disbursement_type === 'day_10' ? 10 : 20;
        const curY = parseInt(year || new Date().getFullYear(), 10);
        const curM = parseInt(month || (new Date().getMonth() + 1), 10);
        desc = `صرف مصروف يوم ${dayNum} لشهر ${curM}/${curY} للموظف: ${emp.name} (${emp.code}) بمبلغ ${amt.toLocaleString('ar-EG')} ج.م`;

        const existing = db.prepare('SELECT amount_day_10, amount_day_20 FROM mid_month_expenses WHERE year = ? AND month = ? AND employee_id = ?')
          .get(curY, curM, emp.id);

        const d10 = dayNum === 10 ? amt : (existing?.amount_day_10 || 0);
        const d20 = dayNum === 20 ? amt : (existing?.amount_day_20 || 0);

        db.prepare(`
          INSERT INTO mid_month_expenses (
            year, month, employee_id, employee_code, employee_name,
            amount_day_10, amount_day_20, total_amount, notes
          ) VALUES (
            @year, @month, @employee_id, @employee_code, @employee_name,
            @amount_day_10, @amount_day_20, @total_amount, @notes
          )
          ON CONFLICT(year, month, employee_id) DO UPDATE SET
            amount_day_10 = CASE WHEN @dayNum = 10 THEN excluded.amount_day_10 ELSE mid_month_expenses.amount_day_10 END,
            amount_day_20 = CASE WHEN @dayNum = 20 THEN excluded.amount_day_20 ELSE mid_month_expenses.amount_day_20 END,
            total_amount = (CASE WHEN @dayNum = 10 THEN excluded.amount_day_10 ELSE mid_month_expenses.amount_day_10 END) +
                           (CASE WHEN @dayNum = 20 THEN excluded.amount_day_20 ELSE mid_month_expenses.amount_day_20 END),
            notes = CASE WHEN excluded.notes != '' THEN excluded.notes ELSE mid_month_expenses.notes END
        `).run({
          year: curY, month: curM,
          employee_id: emp.id, employee_code: emp.code, employee_name: emp.name,
          amount_day_10: d10, amount_day_20: d20, total_amount: d10 + d20,
          notes: notes || `صرف دفعة يوم ${dayNum} من الخزينة`,
          dayNum
        });
      } else if (disbursement_type === 'monthly_loan') {
        txType = 'salary_payment';
        const months = parseInt(months_count || 1, 10);
        const installment = Math.round((amt / months) * 100) / 100;
        const sDate = start_date || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const [startYear, startMonth] = sDate.split('-').map(Number);
        const endDateObj = new Date(startYear, (startMonth - 1) + (months - 1), 1);
        const end_date = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}`;

        desc = `صرف سلفة نقدية للموظف: ${emp.name} (${emp.code}) بمبلغ ${amt.toLocaleString('ar-EG')} ج.م مقسطة على (${months}) شهر بقسط شهري (${installment.toLocaleString('ar-EG')} ج.م)`;

        const loanRes = db.prepare(`
          INSERT INTO loans (
            employee_id, employee_code, employee_name,
            total_amount, months_count, monthly_installment,
            start_date, end_date, paid_installments,
            remaining_amount, status, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'active', ?)
        `).run(
          emp.id, emp.code, emp.name,
          amt, months, installment,
          sDate, end_date, amt,
          notes || `سلفة نقدية من الخزينة مقسطة على ${months} شهر`
        );
        loanId = loanRes.lastInsertRowid;
      } else {
        txType = 'salary_payment';
        desc = `صرف سلفة طارئة للموظف: ${emp.name} (${emp.code}) بمبلغ ${amt.toLocaleString('ar-EG')} ج.م`;
      }

      // 1. Insert Cash Transaction
      const txRes = db.prepare(`
        INSERT INTO cash_transactions (
          safe_id, type, amount, balance_before, balance_after, description,
          related_employee_id, related_employee_name, sender_phone, transaction_date, notes,
          category, packs_detail, receipt_image
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        safe_id, txType, amt, safe.current_balance, newBalance, desc,
        emp.id, courier_name || emp.name, sender_phone || null, txDate, notes || null,
        disbursement_type === 'day_10' ? 'مصروف يوم 10' : disbursement_type === 'day_20' ? 'مصروف يوم 20' : 'سلفة موظف',
        denomination.tafqeet_text || null,
        req.body.receipt_image || null
      );

      // 2. Update Safe Balance
      db.prepare('UPDATE cash_safes SET current_balance = ? WHERE id = ?').run(newBalance, safe_id);

      // 3. Decrement Drawer Denominations
      const denomId = applyDrawerTransaction(safe_id, txRes.lastInsertRowid, txDate, 'expense', denomination, newBalance, `صرف موظف: ${emp.name}`);

      return { txId: txRes.lastInsertRowid, denomId, newBalance, loanId, desc };
    })();

    const safeUpdated = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(safe_id);
    if (safeUpdated) await pushToSupabase('cash_safes', safeUpdated);
    const tx = db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(txResult.txId);
    if (tx) await pushToSupabase('cash_transactions', tx);
    if (txResult.loanId) {
      const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(txResult.loanId);
      if (loan) await pushToSupabase('loans', loan);
    }
    if (disbursement_type === 'day_10' || disbursement_type === 'day_20') {
      const curY = parseInt(year || new Date().getFullYear(), 10);
      const curM = parseInt(month || (new Date().getMonth() + 1), 10);
      const exp = db.prepare('SELECT * FROM mid_month_expenses WHERE year = ? AND month = ? AND employee_id = ?').get(curY, curM, emp.id);
      if (exp) await pushToSupabase('mid_month_expenses', exp);
    }

    res.status(201).json({
      success: true,
      message: 'تم تسجيل الصرف للموظف وتحديث الخزينة والدرج بنجاح',
      data: txResult
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/treasury/disburse-mid-month — Disburse Day 10 / Day 20 expenses from safe directly
router.post('/disburse-mid-month', async (req, res) => {
  try {
    const { safe_id, year, month, day, items, transaction_date, courier_name, sender_phone, notes, denomination } = req.body;
    if (!safe_id || !year || !month || !day || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'البيانات غير مكتملة (safe_id, year, month, day, items)' });
    }

    const safe = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(safe_id);
    if (!safe) return res.status(404).json({ error: 'الخزينة غير موجودة' });

    // Calculate total amount to disburse
    const validItems = items.filter(it => parseFloat(it.amount || 0) > 0);
    const totalAmount = validItems.reduce((sum, it) => sum + parseFloat(it.amount || 0), 0);

    if (totalAmount <= 0) {
      return res.status(400).json({ error: 'إجمالي المبالغ المصروفة يجب أن يكون أكبر من الصفر' });
    }

    if (totalAmount > safe.current_balance) {
      return res.status(400).json({
        error: `رصيد الخزينة (${safe.current_balance.toLocaleString('ar-EG')} ج.م) لا يكفي لصرف إجمالي المصروفات (${totalAmount.toLocaleString('ar-EG')} ج.م)`
      });
    }

    const newBalance = safe.current_balance - totalAmount;
    const dayNum = parseInt(day, 10);
    const txDate = transaction_date || new Date().toISOString().split('T')[0];

    const result = db.transaction(() => {
      // 1. Update / Insert mid_month_expenses for each employee
      const upsertExpenseStmt = db.prepare(`
        INSERT INTO mid_month_expenses (
          year, month, employee_id, employee_code, employee_name,
          amount_day_10, amount_day_20, total_amount, notes
        ) VALUES (
          @year, @month, @employee_id, @employee_code, @employee_name,
          @amount_day_10, @amount_day_20, @total_amount, @notes
        )
        ON CONFLICT(year, month, employee_id) DO UPDATE SET
          amount_day_10 = CASE WHEN @dayNum = 10 THEN excluded.amount_day_10 ELSE mid_month_expenses.amount_day_10 END,
          amount_day_20 = CASE WHEN @dayNum = 20 THEN excluded.amount_day_20 ELSE mid_month_expenses.amount_day_20 END,
          total_amount = (CASE WHEN @dayNum = 10 THEN excluded.amount_day_10 ELSE mid_month_expenses.amount_day_10 END) +
                         (CASE WHEN @dayNum = 20 THEN excluded.amount_day_20 ELSE mid_month_expenses.amount_day_20 END),
          notes = CASE WHEN excluded.notes != '' THEN excluded.notes ELSE mid_month_expenses.notes END
      `);

      for (const item of validItems) {
        const emp = db.prepare('SELECT id, code, name FROM employees WHERE id = ?').get(item.employee_id);
        if (!emp) continue;
        const amt = parseFloat(item.amount || 0);

        // Fetch existing to calculate total correctly
        const existing = db.prepare('SELECT amount_day_10, amount_day_20 FROM mid_month_expenses WHERE year = ? AND month = ? AND employee_id = ?')
          .get(year, month, item.employee_id);

        const d10 = dayNum === 10 ? amt : (existing?.amount_day_10 || 0);
        const d20 = dayNum === 20 ? amt : (existing?.amount_day_20 || 0);

        upsertExpenseStmt.run({
          year: parseInt(year, 10),
          month: parseInt(month, 10),
          employee_id: emp.id,
          employee_code: emp.code,
          employee_name: emp.name,
          amount_day_10: d10,
          amount_day_20: d20,
          total_amount: d10 + d20,
          notes: item.notes || `صرف دفعة يوم ${dayNum} من الخزينة`,
          dayNum
        });
      }

      // 2. Insert cash transaction
      const txStmt = db.prepare(`
        INSERT INTO cash_transactions
          (safe_id, type, amount, balance_before, balance_after, description,
           related_employee_name, sender_phone, transaction_date, notes)
        VALUES (?, 'expense', ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const txRes = txStmt.run(
        safe_id, totalAmount, safe.current_balance, newBalance,
        `صرف مصروفات يوم ${dayNum} لشهر ${month}/${year} لعدد (${validItems.length}) موظف بمبلغ إجمالي ${totalAmount.toLocaleString('ar-EG')} ج.م`,
        courier_name || null, sender_phone || null, txDate, notes || null
      );

      // 3. Deduct from safe balance
      db.prepare('UPDATE cash_safes SET current_balance = ? WHERE id = ?').run(newBalance, safe_id);

      // 4. Denomination snapshot if provided
      let denomId = null;
      if (denomination) {
        const physicalTotal = calcDenomTotal(denomination);
        const diff = physicalTotal - newBalance;
        const denomRes = db.prepare(`
          INSERT INTO cash_denominations
            (safe_id, transaction_id, snapshot_date,
             count_200, count_100, count_50, count_20, count_10, count_5, count_1,
             count_50pt, count_25pt, count_10pt, count_5pt,
             total_physical, book_balance, difference, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          safe_id, txRes.lastInsertRowid, txDate,
          parseInt(denomination.count_200  || 0),
          parseInt(denomination.count_100  || 0),
          parseInt(denomination.count_50   || 0),
          parseInt(denomination.count_20   || 0),
          parseInt(denomination.count_10   || 0),
          parseInt(denomination.count_5    || 0),
          parseInt(denomination.count_1    || 0),
          parseInt(denomination.count_50pt || 0),
          parseInt(denomination.count_25pt || 0),
          parseInt(denomination.count_10pt || 0),
          parseInt(denomination.count_5pt  || 0),
          physicalTotal, newBalance, diff,
          denomination.notes || `جرد درج بعد صرف مصروفات يوم ${dayNum}`
        );
        denomId = denomRes.lastInsertRowid;
      }

      return { txId: txRes.lastInsertRowid, newBalance, denomId, totalAmount, count: validItems.length };
    })();

    const safeUpdated = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(safe_id);
    if (safeUpdated) await pushToSupabase('cash_safes', safeUpdated);
    const tx = db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(result.txId);
    if (tx) await pushToSupabase('cash_transactions', tx);
    const expRows = db.prepare('SELECT * FROM mid_month_expenses WHERE year = ? AND month = ?').all(parseInt(year, 10), parseInt(month, 10));
    if (expRows.length > 0) {
      await pushBatchToSupabase('mid_month_expenses', expRows);
    }

    res.status(201).json({
      success: true,
      message: `تم صرف مصروفات يوم ${dayNum} لشهر ${month}/${year} لعدد (${result.count}) موظف بمبلغ ${result.totalAmount.toLocaleString('ar-EG')} ج.م وخصمها من الخزينة وربطها بالراتب بنجاح`,
      newBalance: result.newBalance,
      totalAmount: result.totalAmount
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/treasury/disburse-loan — Disburse a loan to employee directly from safe
router.post('/disburse-loan', async (req, res) => {
  try {
    const { safe_id, employee_id, total_amount, months_count, start_date, transaction_date, courier_name, sender_phone, notes, denomination } = req.body;

    if (!safe_id || !employee_id || !total_amount || !months_count || !start_date) {
      return res.status(400).json({ error: 'البيانات غير مكتملة (safe_id, employee_id, total_amount, months_count, start_date)' });
    }

    const safe = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(safe_id);
    if (!safe) return res.status(404).json({ error: 'الخزينة غير موجودة' });

    const emp = db.prepare('SELECT id, code, name FROM employees WHERE id = ?').get(employee_id);
    if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });

    const amount = parseFloat(total_amount);
    const months = parseInt(months_count, 10);
    if (isNaN(amount) || amount <= 0 || isNaN(months) || months < 1) {
      return res.status(400).json({ error: 'المبلغ وعدد الشهور يجب أن تكون أرقاماً صحيحة وموجبة' });
    }

    if (amount > safe.current_balance) {
      return res.status(400).json({
        error: `رصيد الخزينة (${safe.current_balance.toLocaleString('ar-EG')} ج.م) لا يكفي لصرف السلفة (${amount.toLocaleString('ar-EG')} ج.م)`
      });
    }

    const installment = Math.round((amount / months) * 100) / 100;
    const [startYear, startMonth] = start_date.split('-').map(Number);
    const endDateObj = new Date(startYear, (startMonth - 1) + (months - 1), 1);
    const end_date = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}`;
    const txDate = transaction_date || new Date().toISOString().split('T')[0];
    const newBalance = safe.current_balance - amount;

    const result = db.transaction(() => {
      // 1. Insert into loans table (flows automatically into payroll)
      const loanRes = db.prepare(`
        INSERT INTO loans (
          employee_id, employee_code, employee_name,
          total_amount, months_count, monthly_installment,
          start_date, end_date, paid_installments,
          remaining_amount, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'active', ?)
      `).run(
        emp.id, emp.code, emp.name,
        amount, months, installment,
        start_date, end_date, amount,
        notes || `سلفة نقدية من الخزينة مقسطة على ${months} شهر`
      );

      // 2. Insert into cash_transactions
      const desc = `صرف سلفة نقدية للموظف: ${emp.name} (${emp.code}) بمبلغ ${amount.toLocaleString('ar-EG')} ج.م مقسطة على (${months}) شهر بقسط شهري (${installment.toLocaleString('ar-EG')} ج.م)`;
      const txRes = db.prepare(`
        INSERT INTO cash_transactions
          (safe_id, type, amount, balance_before, balance_after, description,
           related_employee_id, related_employee_name, sender_phone, transaction_date, notes)
        VALUES (?, 'salary_payment', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        safe_id, amount, safe.current_balance, newBalance, desc,
        emp.id, courier_name || emp.name, sender_phone || null, txDate, notes || null
      );

      // 3. Deduct from safe balance
      db.prepare('UPDATE cash_safes SET current_balance = ? WHERE id = ?').run(newBalance, safe_id);

      // 4. Denomination snapshot if provided
      let denomId = null;
      if (denomination) {
        const physicalTotal = calcDenomTotal(denomination);
        const diff = physicalTotal - newBalance;
        const denomRes = db.prepare(`
          INSERT INTO cash_denominations
            (safe_id, transaction_id, snapshot_date,
             count_200, count_100, count_50, count_20, count_10, count_5, count_1,
             count_50pt, count_25pt, count_10pt, count_5pt,
             total_physical, book_balance, difference, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          safe_id, txRes.lastInsertRowid, txDate,
          parseInt(denomination.count_200  || 0),
          parseInt(denomination.count_100  || 0),
          parseInt(denomination.count_50   || 0),
          parseInt(denomination.count_20   || 0),
          parseInt(denomination.count_10   || 0),
          parseInt(denomination.count_5    || 0),
          parseInt(denomination.count_1    || 0),
          parseInt(denomination.count_50pt || 0),
          parseInt(denomination.count_25pt || 0),
          parseInt(denomination.count_10pt || 0),
          parseInt(denomination.count_5pt  || 0),
          physicalTotal, newBalance, diff,
          denomination.notes || `جرد درج بعد صرف سلفة ${emp.name}`
        );
        denomId = denomRes.lastInsertRowid;
      }

      return {
        loanId: loanRes.lastInsertRowid,
        txId: txRes.lastInsertRowid,
        newBalance,
        denomId,
        installment,
        end_date
      };
    })();

    const safeUpdated = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(safe_id);
    if (safeUpdated) await pushToSupabase('cash_safes', safeUpdated);
    const tx = db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(result.txId);
    if (tx) await pushToSupabase('cash_transactions', tx);
    if (result.loanId) {
      const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(result.loanId);
      if (loan) await pushToSupabase('loans', loan);
    }

    res.status(201).json({
      success: true,
      message: `تم صرف السلفة بمبلغ ${amount.toLocaleString('ar-EG')} ج.م للموظف ${emp.name} بنجاح وقيدها على أقساط شهرية تبدأ من ${start_date} حتى ${result.end_date}`,
      data: {
        loanId: result.loanId,
        employee_name: emp.name,
        amount,
        months_count: months,
        installment: result.installment,
        start_date,
        end_date: result.end_date,
        newBalance: result.newBalance
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Recalculate safe balance strictly from actual remaining transactions
export function recalculateSafeBalance(safeId) {
  if (!safeId) return 0;
  const creditTypes = ['custody_receive', 'income', 'transfer_in', 'farm_sale'];
  const debitTypes = ['expense', 'transfer_out', 'salary_payment', 'custody_return', 'sub_replenish'];
  const txs = db.prepare('SELECT type, amount FROM cash_transactions WHERE safe_id = ? ORDER BY id ASC').all(safeId);
  let bal = 0;
  for (const t of txs) {
    if (creditTypes.includes(t.type)) bal += t.amount;
    else if (debitTypes.includes(t.type)) bal -= t.amount;
  }
  db.prepare('UPDATE cash_safes SET current_balance = ? WHERE id = ?').run(bal, safeId);
  return bal;
}

// POST /api/treasury/recalculate-all — Sync and recompute all safe balances
router.post('/recalculate-all', (req, res) => {
  try {
    const safes = db.prepare('SELECT id FROM cash_safes').all();
    for (const s of safes) {
      recalculateSafeBalance(s.id);
    }
    const updated = db.prepare('SELECT id, name, type, current_balance FROM cash_safes').all();
    res.json({
      success: true,
      message: 'تم تدقيق وإعادة احتساب رصيد كافة الخزائن من واقع الحركات الفعلية بنجاح',
      data: updated
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/treasury/transactions/:id — reverse/delete transaction with strict balance recomputation
router.delete('/transactions/:id', async (req, res) => {
  try {
    const tx = db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(req.params.id);
    if (!tx) return res.status(404).json({ error: 'الحركة غير موجودة' });

    const safeId = tx.safe_id;
    const relSafeId = tx.related_safe_id;

    db.transaction(() => {
      // If this was a transfer_out/sub_replenish, delete mirror transfer_in
      if ((tx.type === 'transfer_out' || tx.type === 'sub_replenish') && relSafeId) {
        const mirror = db.prepare(`
          SELECT * FROM cash_transactions
          WHERE safe_id = ? AND type = 'transfer_in' AND amount = ? AND transaction_date = ?
          ORDER BY id DESC LIMIT 1
        `).get(relSafeId, tx.amount, tx.transaction_date);
        if (mirror) {
          db.prepare('DELETE FROM cash_denominations WHERE transaction_id = ?').run(mirror.id);
          db.prepare('DELETE FROM cash_transactions WHERE id = ?').run(mirror.id);
        }
      }

      db.prepare('DELETE FROM cash_denominations WHERE transaction_id = ?').run(tx.id);
      db.prepare('DELETE FROM cash_transactions WHERE id = ?').run(tx.id);

      // Recalculate balances cleanly from actual remaining transactions
      recalculateSafeBalance(safeId);
      if (relSafeId) recalculateSafeBalance(relSafeId);
    })();

    // Real-time Supabase sync
    await deleteFromSupabase('cash_transactions', tx.id);
    const safeAfter = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(safeId);
    if (safeAfter) await pushToSupabase('cash_safes', safeAfter);
    if (relSafeId) {
      const relSafeAfter = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(relSafeId);
      if (relSafeAfter) await pushToSupabase('cash_safes', relSafeAfter);
    }

    res.json({ success: true, message: 'تم حذف الحركة وإعادة تدقيق رصيد الخزينة بنجاح' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── DENOMINATIONS (DRAWER) ────────────────────────────────────────────────────

// GET /api/treasury/denominations?safe_id=&limit=
router.get('/denominations', (req, res) => {
  try {
    const { safe_id, limit = 50 } = req.query;
    let q = `
      SELECT d.*, s.name as safe_name, s.current_balance
      FROM cash_denominations d
      LEFT JOIN cash_safes s ON s.id = d.safe_id
      WHERE 1=1
    `;
    const params = [];
    if (safe_id) { q += ' AND d.safe_id = ?'; params.push(safe_id); }
    q += ` ORDER BY d.id DESC LIMIT ${parseInt(limit)}`;
    res.json({ success: true, data: db.prepare(q).all(...params) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/treasury/denominations  — manual denomination snapshot (no transaction)
router.post('/denominations', (req, res) => {
  try {
    const { safe_id, snapshot_date, notes, ...counts } = req.body;
    if (!safe_id || !snapshot_date) {
      return res.status(400).json({ error: 'safe_id و snapshot_date مطلوبان' });
    }
    const safe = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(safe_id);
    if (!safe) return res.status(404).json({ error: 'الخزينة غير موجودة' });

    const physicalTotal = calcDenomTotal(counts);
    const diff = physicalTotal - safe.current_balance;

    const p200 = parseInt(counts.packs_200 || 0, 10);
    const l200 = parseInt(counts.loose_200 !== undefined && counts.loose_200 !== '' ? counts.loose_200 : (counts.count_200 || 0), 10);
    const c200 = (p200 * 100) + l200;

    const p100 = parseInt(counts.packs_100 || 0, 10);
    const l100 = parseInt(counts.loose_100 !== undefined && counts.loose_100 !== '' ? counts.loose_100 : (counts.count_100 || 0), 10);
    const c100 = (p100 * 100) + l100;

    const p50 = parseInt(counts.packs_50 || 0, 10);
    const l50 = parseInt(counts.loose_50 !== undefined && counts.loose_50 !== '' ? counts.loose_50 : (counts.count_50 || 0), 10);
    const c50 = (p50 * 100) + l50;

    const p20 = parseInt(counts.packs_20 || 0, 10);
    const l20 = parseInt(counts.loose_20 !== undefined && counts.loose_20 !== '' ? counts.loose_20 : (counts.count_20 || 0), 10);
    const c20 = (p20 * 100) + l20;

    const p10 = parseInt(counts.packs_10 || 0, 10);
    const l10 = parseInt(counts.loose_10 !== undefined && counts.loose_10 !== '' ? counts.loose_10 : (counts.count_10 || 0), 10);
    const c10 = (p10 * 100) + l10;

    const p5 = parseInt(counts.packs_5 || 0, 10);
    const l5 = parseInt(counts.loose_5 !== undefined && counts.loose_5 !== '' ? counts.loose_5 : (counts.count_5 || 0), 10);
    const c5 = (p5 * 100) + l5;

    const result = db.prepare(`
      INSERT INTO cash_denominations
        (safe_id, transaction_id, snapshot_date,
         count_200, count_100, count_50, count_20, count_10, count_5, count_1,
         count_50pt, count_25pt, count_10pt, count_5pt,
         packs_200, loose_200, packs_100, loose_100, packs_50, loose_50,
         packs_20, loose_20, packs_10, loose_10, packs_5, loose_5,
         tafqeet_text, total_physical, book_balance, difference, notes)
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      safe_id, snapshot_date,
      c200, c100, c50, c20, c10, c5,
      parseInt(counts.count_1    || 0, 10),
      parseInt(counts.count_50pt || 0, 10),
      parseInt(counts.count_25pt || 0, 10),
      parseInt(counts.count_10pt || 0, 10),
      parseInt(counts.count_5pt  || 0, 10),
      p200, l200, p100, l100, p50, l50,
      p20, l20, p10, l10, p5, l5,
      counts.tafqeet_text || null,
      physicalTotal, safe.current_balance, diff, notes || null
    );

    const snap = db.prepare('SELECT * FROM cash_denominations WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: snap, difference: diff });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── MONTH-END CLOSE ──────────────────────────────────────────────────────────

// POST /api/treasury/month-end-close  — return sub safe balance to main safe
router.post('/month-end-close', (req, res) => {
  try {
    const { sub_safe_id, transaction_date, notes } = req.body;
    if (!sub_safe_id || !transaction_date) {
      return res.status(400).json({ error: 'sub_safe_id و transaction_date مطلوبان' });
    }

    const subSafe = db.prepare('SELECT * FROM cash_safes WHERE id = ? AND type = ?').get(sub_safe_id, 'sub');
    if (!subSafe) return res.status(404).json({ error: 'الخزينة الفرعية غير موجودة' });
    if (!subSafe.parent_safe_id) return res.status(400).json({ error: 'الخزينة الفرعية لا تحدد الخزينة الأم' });

    const mainSafe = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(subSafe.parent_safe_id);
    if (!mainSafe) return res.status(404).json({ error: 'الخزينة الرئيسية غير موجودة' });

    const returnAmount = subSafe.current_balance;
    if (returnAmount <= 0) {
      return res.json({ success: true, message: 'رصيد الخزينة الفرعية صفر — لا يوجد مبلغ للإعادة', returnAmount: 0 });
    }

    db.transaction(() => {
      // Debit sub safe
      db.prepare(`
        INSERT INTO cash_transactions
          (safe_id, type, amount, balance_before, balance_after, description,
           related_safe_id, transaction_date, notes)
        VALUES (?, 'custody_return', ?, ?, 0, ?, ?, ?, ?)
      `).run(sub_safe_id, returnAmount, returnAmount,
             `إقفال الشهر — رد متبقي الخزينة الفرعية إلى ${mainSafe.name}`,
             mainSafe.id, transaction_date, notes || 'إقفال شهري');
      db.prepare('UPDATE cash_safes SET current_balance = 0 WHERE id = ?').run(sub_safe_id);

      // Credit main safe
      const mainNewBal = mainSafe.current_balance + returnAmount;
      db.prepare(`
        INSERT INTO cash_transactions
          (safe_id, type, amount, balance_before, balance_after, description,
           related_safe_id, transaction_date, notes)
        VALUES (?, 'transfer_in', ?, ?, ?, ?, ?, ?, ?)
      `).run(mainSafe.id, returnAmount, mainSafe.current_balance, mainNewBal,
             `استلام رد متبقي خزينة: ${subSafe.name}`,
             sub_safe_id, transaction_date, notes || 'إقفال شهري');
      db.prepare('UPDATE cash_safes SET current_balance = ? WHERE id = ?').run(mainNewBal, mainSafe.id);
    })();

    res.json({
      success: true,
      returnAmount,
      message: `تم إعادة ${returnAmount.toLocaleString('ar-EG')} ج.م من ${subSafe.name} إلى ${mainSafe.name}`
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── SUMMARY ──────────────────────────────────────────────────────────────────

// GET /api/treasury/summary?safe_id=&year=&month=
// COMPLETELY SEPARATE MAIN SAFE AND SUB SAFES
router.get('/summary', (req, res) => {
  try {
    const { safe_id, year, month } = req.query;
    const safes = db.prepare(`SELECT * FROM cash_safes WHERE is_active = 1 ORDER BY type DESC, id ASC`).all();

    let mainBookBalance = 0;
    let mainPhysicalDrawer = 0;
    let subBookBalance = 0;

    const summary = safes.map(safe => {
      let q = `
        SELECT
          SUM(CASE WHEN type IN ('custody_receive','income','transfer_in') THEN amount ELSE 0 END) as total_in,
          SUM(CASE WHEN type IN ('expense','transfer_out','salary_payment','custody_return','sub_replenish') THEN amount ELSE 0 END) as total_out,
          COUNT(*) as tx_count
        FROM cash_transactions
        WHERE safe_id = ?
      `;
      const params = [safe.id];
      if (year && month) {
        const ym = `${year}-${String(month).padStart(2,'0')}`;
        q += ` AND strftime('%Y-%m', transaction_date) = ?`;
        params.push(ym);
      } else if (year) {
        q += ` AND strftime('%Y', transaction_date) = ?`;
        params.push(String(year));
      }

      const stats = db.prepare(q).get(...params);
      let lastDenom = null;
      let physicalDrawer = safe.current_balance;

      if (safe.type === 'main') {
        lastDenom = db.prepare(`SELECT * FROM cash_denominations WHERE safe_id = ? ORDER BY id DESC LIMIT 1`).get(safe.id);
        physicalDrawer = lastDenom ? lastDenom.total_physical : safe.current_balance;
        mainBookBalance += safe.current_balance;
        mainPhysicalDrawer += physicalDrawer;
      } else {
        subBookBalance += safe.current_balance;
      }

      const diff = physicalDrawer - safe.current_balance;

      return {
        ...safe,
        total_in: stats?.total_in || 0,
        total_out: stats?.total_out || 0,
        tx_count: stats?.tx_count || 0,
        last_denomination: lastDenom || null,
        physical_drawer: physicalDrawer,
        difference: diff,
        is_exact: Math.abs(diff) < 0.01,
        has_counted: !!lastDenom
      };
    });

    const mainDiff = mainPhysicalDrawer - mainBookBalance;
    const totals = {
      // Main Safe (Independent - responsible employee 1)
      main_book_balance: mainBookBalance,
      main_physical_drawer: mainPhysicalDrawer,
      main_difference: mainDiff,
      main_is_exact: Math.abs(mainDiff) < 0.01,
      main_variance_status: Math.abs(mainDiff) < 0.01 ? 'exact' : (mainDiff > 0 ? 'surplus' : 'deficit'),
      // Sub Safes (Independent - responsible employee 2)
      sub_book_balance: subBookBalance,
      sub_safes_count: safes.filter(s => s.type === 'sub').length,
      count_safes: safes.length
    };

    res.json({ success: true, data: summary, totals });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── REPORT: DRIVERS EXPENSES REPORT ──────────────────────────────────────────
router.get('/reports/drivers', (req, res) => {
  try {
    const { from, to, safe_id, driver_name } = req.query;
    let q = `
      SELECT 
        t.related_employee_name as driver_name,
        COUNT(t.id) as receipts_count,
        SUM(t.amount) as total_amount,
        SUM(CASE WHEN t.category LIKE '%كارتات%' OR t.category LIKE '%بوابات%' OR t.category LIKE '%موازين%' THEN t.amount ELSE 0 END) as toll_amount,
        SUM(CASE WHEN t.category LIKE '%كاوتش%' OR t.category LIKE '%بنشر%' OR t.category LIKE '%صيانة%' THEN t.amount ELSE 0 END) as maintenance_amount,
        SUM(CASE WHEN t.category LIKE '%نظافة%' OR t.category LIKE '%بوفيه%' OR t.category LIKE '%مهمات%' THEN t.amount ELSE 0 END) as supplies_amount,
        SUM(CASE WHEN t.category LIKE '%إكراميات%' OR t.category LIKE '%نثريات%' THEN t.amount ELSE 0 END) as tips_amount,
        SUM(CASE WHEN t.category NOT LIKE '%كارتات%' AND t.category NOT LIKE '%بوابات%' AND t.category NOT LIKE '%موازين%' 
                 AND t.category NOT LIKE '%كاوتش%' AND t.category NOT LIKE '%بنشر%' AND t.category NOT LIKE '%صيانة%' 
                 AND t.category NOT LIKE '%نظافة%' AND t.category NOT LIKE '%بوفيه%' AND t.category NOT LIKE '%مهمات%' 
                 AND t.category NOT LIKE '%إكراميات%' AND t.category NOT LIKE '%نثريات%' THEN t.amount ELSE 0 END) as other_amount
      FROM cash_transactions t
      JOIN cash_safes s ON s.id = t.safe_id
      WHERE t.type = 'expense'
        AND t.related_employee_name IS NOT NULL
        AND TRIM(t.related_employee_name) != ''
    `;
    const params = [];
    if (safe_id) { q += ' AND t.safe_id = ?'; params.push(safe_id); }
    if (from)    { q += ' AND t.transaction_date >= ?'; params.push(from); }
    if (to)      { q += ' AND t.transaction_date <= ?'; params.push(to); }
    if (driver_name && driver_name !== 'all') { q += ' AND t.related_employee_name = ?'; params.push(driver_name); }

    q += ' GROUP BY t.related_employee_name ORDER BY total_amount DESC';
    const driverSummary = db.prepare(q).all(...params);

    // Detailed items for drivers
    let detailQ = `
      SELECT t.*, s.name as safe_name
      FROM cash_transactions t
      JOIN cash_safes s ON s.id = t.safe_id
      WHERE t.type = 'expense'
        AND t.related_employee_name IS NOT NULL
        AND TRIM(t.related_employee_name) != ''
    `;
    const detailParams = [];
    if (safe_id) { detailQ += ' AND t.safe_id = ?'; detailParams.push(safe_id); }
    if (from)    { detailQ += ' AND t.transaction_date >= ?'; detailParams.push(from); }
    if (to)      { detailQ += ' AND t.transaction_date <= ?'; detailParams.push(to); }
    if (driver_name && driver_name !== 'all') { detailQ += ' AND t.related_employee_name = ?'; detailParams.push(driver_name); }
    detailQ += ' ORDER BY t.transaction_date DESC, t.id DESC LIMIT 400';

    const details = db.prepare(detailQ).all(...detailParams);

    // Unique drivers list for filtering
    const driversList = db.prepare(`
      SELECT DISTINCT related_employee_name as driver_name
      FROM cash_transactions
      WHERE related_employee_name IS NOT NULL AND TRIM(related_employee_name) != ''
      ORDER BY related_employee_name ASC
    `).all().map(r => r.driver_name);

    const totalOverall = driverSummary.reduce((sum, d) => sum + (d.total_amount || 0), 0);
    const totalReceipts = driverSummary.reduce((sum, d) => sum + (d.receipts_count || 0), 0);

    res.json({
      success: true,
      data: {
        summary: driverSummary,
        details,
        driversList,
        totalOverall,
        totalReceipts
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── REPORT: FARM REVENUE & EXPENSES COMPREHENSIVE REPORT ─────────────────────
router.get('/reports/farm', (req, res) => {
  try {
    const { from, to } = req.query;

    let q = `
      SELECT t.*, s.name as safe_name, s.type as safe_type
      FROM cash_transactions t
      JOIN cash_safes s ON s.id = t.safe_id
      WHERE (
        t.cost_center = 'farm'
        OR s.name LIKE '%مزرعة%'
        OR t.category LIKE '%مزرعة%'
        OR t.category LIKE '%أسمدة%'
        OR t.category LIKE '%تقليم%'
        OR t.category LIKE '%بذور%'
        OR t.category LIKE '%شتلات%'
        OR t.category LIKE '%شجر%'
        OR t.category LIKE '%ري%'
        OR t.category LIKE '%مانجو%'
        OR t.category LIKE '%بلح%'
        OR t.type = 'farm_sale'
      )
    `;
    const params = [];
    if (from) { q += ' AND t.transaction_date >= ?'; params.push(from); }
    if (to)   { q += ' AND t.transaction_date <= ?'; params.push(to); }
    q += ' ORDER BY t.transaction_date DESC, t.id DESC';

    const rows = db.prepare(q).all(...params);

    // Calculate metrics
    let totalCropSales = 0;
    let mangoSales = 0;
    let dateSales = 0;
    let otherSales = 0;

    let mainExpenses = 0;
    let subExpenses = 0;

    for (const r of rows) {
      const isIncome = (r.type === 'farm_sale' || r.type === 'income');
      if (isIncome) {
        totalCropSales += r.amount;
        const text = `${r.crop_type || ''} ${r.description || ''} ${r.category || ''}`;
        if (text.includes('مانجو')) mangoSales += r.amount;
        else if (text.includes('بلح') || text.includes('نخيل')) dateSales += r.amount;
        else otherSales += r.amount;
      } else if (r.type === 'expense') {
        if (r.safe_type === 'main') {
          mainExpenses += r.amount;
        } else {
          subExpenses += r.amount;
        }
      }
    }

    const totalExpenses = mainExpenses + subExpenses;
    const netProfit = totalCropSales - totalExpenses;

    const farmSafe = db.prepare("SELECT * FROM cash_safes WHERE name LIKE '%مزرعة%' LIMIT 1").get();

    res.json({
      success: true,
      data: {
        transactions: rows,
        farmSafe: farmSafe || null,
        metrics: {
          totalCropSales,
          mangoSales,
          dateSales,
          otherSales,
          mainExpenses,
          subExpenses,
          totalExpenses,
          netProfit
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/treasury/supabase-status
router.get('/supabase-status', async (req, res) => {
  try {
    const status = await getLiveSyncStatus(db);
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/treasury/supabase-sync-now
router.post('/supabase-sync-now', async (req, res) => {
  try {
    const result = await syncDatabase(db);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/treasury/sub-safes/replenish (Dedicated sub-safe feeding from main safe)
router.post('/sub-safes/replenish', async (req, res) => {
  try {
    const { main_safe_id, sub_safe_id, amount, date, notes } = req.body;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'المبلغ غير صالح' });
    if (!main_safe_id || !sub_safe_id) return res.status(400).json({ error: 'يجب تحديد الخزينة الرئيسية والفرعية' });

    const mainSafe = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(main_safe_id);
    const subSafe = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(sub_safe_id);
    if (!mainSafe || !subSafe) return res.status(404).json({ error: 'إحدى الخزائن غير موجودة' });

    if (amt > mainSafe.current_balance) {
      return res.status(400).json({
        error: `رصيد الخزينة الرئيسية (${mainSafe.current_balance.toLocaleString('ar-EG')} ج.م) لا يكفي لتغذية العهدة بهذا المبلغ`
      });
    }

    const txDate = date || new Date().toISOString().split('T')[0];
    const mainNewBal = mainSafe.current_balance - amt;
    const subNewBal = subSafe.current_balance + amt;
    let mainTxId = null;
    let subTxId = null;

    db.transaction(() => {
      // 1. Out from main
      const mRes = db.prepare(`
        INSERT INTO cash_transactions
          (safe_id, type, amount, balance_before, balance_after, description,
           related_safe_id, transaction_date, notes)
        VALUES (?, 'sub_replenish', ?, ?, ?, ?, ?, ?, ?)
      `).run(main_safe_id, amt, mainSafe.current_balance, mainNewBal,
             `تغذية عهدة الخزينة الفرعية (${subSafe.name})`, sub_safe_id, txDate, notes || null);
      mainTxId = mRes.lastInsertRowid;
      db.prepare('UPDATE cash_safes SET current_balance = ? WHERE id = ?').run(mainNewBal, main_safe_id);

      // 2. In to sub
      const sRes = db.prepare(`
        INSERT INTO cash_transactions
          (safe_id, type, amount, balance_before, balance_after, description,
           related_safe_id, transaction_date, notes)
        VALUES (?, 'transfer_in', ?, ?, ?, ?, ?, ?, ?)
      `).run(sub_safe_id, amt, subSafe.current_balance, subNewBal,
             `عهدة واردة من: ${mainSafe.name}`, main_safe_id, txDate, notes || null);
      subTxId = sRes.lastInsertRowid;
      db.prepare('UPDATE cash_safes SET current_balance = ? WHERE id = ?').run(subNewBal, sub_safe_id);
    })();

    const mainSafeAfter = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(main_safe_id);
    const subSafeAfter = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(sub_safe_id);
    const mainTx = db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(mainTxId);
    const subTx = db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(subTxId);

    await pushToSupabase('cash_safes', mainSafeAfter);
    await pushToSupabase('cash_safes', subSafeAfter);
    await pushToSupabase('cash_transactions', mainTx);
    await pushToSupabase('cash_transactions', subTx);

    res.json({
      success: true,
      message: `تمت تغذية عهدة خزينة (${subSafe.name}) بمبلغ ${amt.toLocaleString('ar-EG')} ج.م بنجاح`,
      main_balance: mainNewBal,
      sub_balance: subNewBal
    });
  } catch (err) {
    console.error('Error replenishing sub safe:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── CASH TRUSTS & TEMPORARY CUSTODIES (الأمانات والعهد المؤقتة ومواعيد الرد) ───

// GET /api/treasury/trusts
router.get('/trusts', (req, res) => {
  try {
    const { status, safe_id, employee_id, search } = req.query;
    let query = `
      SELECT t.*, s.name as safe_name, e.code as employee_code
      FROM cash_trusts t
      LEFT JOIN cash_safes s ON s.id = t.safe_id
      LEFT JOIN employees e ON e.id = t.employee_id
      WHERE 1=1
    `;
    const params = [];
    if (safe_id) {
      query += ` AND t.safe_id = ?`;
      params.push(safe_id);
    }
    if (employee_id) {
      query += ` AND t.employee_id = ?`;
      params.push(employee_id);
    }
    if (search) {
      query += ` AND (t.person_name LIKE ? OR t.person_phone LIKE ? OR t.purpose LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    query += ` ORDER BY t.created_at DESC`;
    const trusts = db.prepare(query).all(...params);

    const today = new Date().toISOString().split('T')[0];
    const enriched = trusts.map(t => {
      const isOverdue = t.remaining_amount > 0 && t.due_date && t.due_date < today;
      const computedStatus = t.remaining_amount <= 0.01 ? 'returned' : (isOverdue ? 'overdue' : 'active');
      return {
        ...t,
        is_overdue: isOverdue,
        computed_status: computedStatus
      };
    });

    let filtered = enriched;
    if (status && status !== 'all') {
      filtered = enriched.filter(t => t.computed_status === status);
    }

    res.json({ success: true, data: filtered });
  } catch (err) {
    console.error('Error fetching trusts:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/treasury/trusts (Disburse trust / custody to an employee or external person)
router.post('/trusts', async (req, res) => {
  try {
    const {
      safe_id, person_type, employee_id, person_name, person_phone, person_national_id,
      amount, given_date, due_date, purpose, notes
    } = req.body;

    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'مبلغ الأمانة غير صالح' });
    if (!safe_id) return res.status(400).json({ error: 'يجب اختيار الخزينة المنصرف منها' });
    if (!person_name || !person_name.trim()) return res.status(400).json({ error: 'يجب تحديد اسم المستلم' });
    if (!due_date) return res.status(400).json({ error: 'يجب تحديد موعد الرد المتفق عليه' });

    const safe = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(safe_id);
    if (!safe) return res.status(404).json({ error: 'الخزينة غير موجودة' });
    if (amt > safe.current_balance) {
      return res.status(400).json({
        error: `رصيد الخزينة الحالي (${safe.current_balance.toLocaleString('ar-EG')} ج.م) لا يكفي لصرف هذا المبلغ`
      });
    }

    const todayStr = given_date || new Date().toISOString().split('T')[0];
    const newSafeBal = safe.current_balance - amt;

    let trustId = null;
    let txId = null;

    db.transaction(() => {
      // 1. Transaction to debit safe
      const desc = `صرف أمانة / عهدة مؤقتة طرف: ${person_name.trim()} (موعد الرد: ${due_date})`;
      const txStmt = db.prepare(`
        INSERT INTO cash_transactions
          (safe_id, type, amount, balance_before, balance_after, description,
           related_employee_id, related_employee_name, sender_phone,
           transaction_date, notes)
        VALUES (?, 'expense', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const txRes = txStmt.run(
        safe_id, amt, safe.current_balance, newSafeBal, desc,
        employee_id || null, person_name.trim(), person_phone || null,
        todayStr, notes || purpose || null
      );
      txId = txRes.lastInsertRowid;

      // 2. Update safe balance
      db.prepare('UPDATE cash_safes SET current_balance = ? WHERE id = ?').run(newSafeBal, safe_id);

      // 3. Insert trust record
      const trustStmt = db.prepare(`
        INSERT INTO cash_trusts
          (safe_id, person_type, employee_id, person_name, person_phone, person_national_id,
           amount, returned_amount, remaining_amount, given_date, due_date, status,
           purpose, notes, disburse_tx_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'active', ?, ?, ?)
      `);
      const trustRes = trustStmt.run(
        safe_id, person_type || 'employee', employee_id || null, person_name.trim(),
        person_phone || null, person_national_id || null,
        amt, amt, todayStr, due_date, purpose || null, notes || null, txId
      );
      trustId = trustRes.lastInsertRowid;
    })();

    const updatedSafe = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(safe_id);
    const newTrust = db.prepare('SELECT * FROM cash_trusts WHERE id = ?').get(trustId);
    const newTx = db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(txId);

    await pushToSupabase('cash_transactions', newTx);
    await pushToSupabase('cash_safes', updatedSafe);
    await pushToSupabase('cash_trusts', newTrust);

    res.status(201).json({
      success: true,
      message: `تم صرف الأمانة بمبلغ ${amt.toLocaleString('ar-EG')} ج.م وتحديد موعد الرد بتاريخ ${due_date}`,
      data: newTrust,
      safe_balance: newSafeBal
    });
  } catch (err) {
    console.error('Error creating trust:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/treasury/trusts/:id/return (Return trust amount & clear from person)
router.post('/trusts/:id/return', async (req, res) => {
  try {
    const trustId = req.params.id;
    const { return_safe_id, amount, return_date, notes } = req.body;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'مبلغ الرد غير صالح' });

    const trust = db.prepare('SELECT * FROM cash_trusts WHERE id = ?').get(trustId);
    if (!trust) return res.status(404).json({ error: 'سجل الأمانة غير موجود' });
    if (amt > trust.remaining_amount + 0.01) {
      return res.status(400).json({
        error: `المبلغ المطلوب رده (${amt}) أكبر من المبلغ المتبقي طرف الشخص (${trust.remaining_amount})`
      });
    }

    const safeId = return_safe_id || trust.safe_id;
    const safe = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(safeId);
    if (!safe) return res.status(404).json({ error: 'الخزينة المودع بها غير موجودة' });

    const retDate = return_date || new Date().toISOString().split('T')[0];
    const newSafeBal = safe.current_balance + amt;
    const newReturned = trust.returned_amount + amt;
    const newRemaining = Math.max(0, trust.amount - newReturned);
    const newStatus = newRemaining <= 0.01 ? 'returned' : 'active';
    let returnTxId = null;

    db.transaction(() => {
      // 1. Transaction to credit safe
      const desc = `رد واسترداد أمانة / عهدة من طرف: ${trust.person_name} (المتبقي: ${newRemaining > 0 ? newRemaining.toLocaleString() + ' ج.م' : 'تم الرد بالكامل وتصفية العهدة'})`;
      const txStmt = db.prepare(`
        INSERT INTO cash_transactions
          (safe_id, type, amount, balance_before, balance_after, description,
           related_employee_id, related_employee_name, sender_phone,
           transaction_date, notes)
        VALUES (?, 'income', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const txRes = txStmt.run(
        safeId, amt, safe.current_balance, newSafeBal, desc,
        trust.employee_id || null, trust.person_name, trust.person_phone || null,
        retDate, notes || null
      );
      returnTxId = txRes.lastInsertRowid;

      // 2. Update safe balance
      db.prepare('UPDATE cash_safes SET current_balance = ? WHERE id = ?').run(newSafeBal, safeId);

      // 3. Insert return history
      db.prepare(`
        INSERT INTO cash_trust_returns (trust_id, safe_id, amount, return_date, notes, tx_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(trustId, safeId, amt, retDate, notes || null, returnTxId);

      // 4. Update trust record (clears / reduces the remaining amount)
      db.prepare(`
        UPDATE cash_trusts
        SET returned_amount = ?, remaining_amount = ?, status = ?,
            return_date = CASE WHEN ? = 'returned' THEN ? ELSE return_date END,
            return_tx_id = ?
        WHERE id = ?
      `).run(newReturned, newRemaining, newStatus, newStatus, retDate, returnTxId, trustId);
    })();

    const updatedSafe = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(safeId);
    const updatedTrust = db.prepare('SELECT * FROM cash_trusts WHERE id = ?').get(trustId);
    const returnTx = db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(returnTxId);

    await pushToSupabase('cash_transactions', returnTx);
    await pushToSupabase('cash_safes', updatedSafe);
    await pushToSupabase('cash_trusts', updatedTrust);

    res.json({
      success: true,
      message: newStatus === 'returned'
        ? `تم رد الأمانة بالكامل وتصفية المبلغ وحذفه من على ${trust.person_name} بنجاح`
        : `تم رد جزء من الأمانة بمبلغ ${amt.toLocaleString()} ج.م، والمتبقي طرفه ${newRemaining.toLocaleString()} ج.م`,
      data: updatedTrust,
      safe_balance: newSafeBal
    });
  } catch (err) {
    console.error('Error returning trust:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/treasury/trusts/:id (Cancel / Delete trust)
router.delete('/trusts/:id', async (req, res) => {
  try {
    const trustId = req.params.id;
    const trust = db.prepare('SELECT * FROM cash_trusts WHERE id = ?').get(trustId);
    if (!trust) return res.status(404).json({ error: 'سجل الأمانة غير موجود' });

    // Revert safe balance if no return occurred yet
    if (trust.returned_amount === 0) {
      const safe = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(trust.safe_id);
      if (safe) {
        db.prepare('UPDATE cash_safes SET current_balance = current_balance + ? WHERE id = ?')
          .run(trust.amount, trust.safe_id);
        const safeAfter = db.prepare('SELECT * FROM cash_safes WHERE id = ?').get(trust.safe_id);
        if (safeAfter) await pushToSupabase('cash_safes', safeAfter);
      }
    }

    const disburseTxId = trust.disburse_tx_id;
    db.prepare('DELETE FROM cash_trust_returns WHERE trust_id = ?').run(trustId);
    db.prepare('DELETE FROM cash_trusts WHERE id = ?').run(trustId);
    await deleteFromSupabase('cash_trusts', trustId);

    if (trust.returned_amount === 0 && disburseTxId) {
      try {
        db.prepare('DELETE FROM cash_transactions WHERE id = ?').run(disburseTxId);
        await deleteFromSupabase('cash_transactions', disburseTxId);
      } catch (e) {}
    }

    res.json({ success: true, message: 'تم حذف وإلغاء سجل الأمانة بنجاح' });
  } catch (err) {
    console.error('Error deleting trust:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
