
from flask import Flask, render_template, request, redirect, url_for, flash
from database import get_db_connection

app = Flask(__name__)
app.secret_key = "distribution-local-secret-key"


# =========================
# DASHBOARD
# =========================
@app.route("/")
def dashboard():
    conn = None

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                COUNT(*),
                COUNT(*) FILTER (WHERE status = 'CREATED'),
                COUNT(*) FILTER (WHERE status = 'SHIPPED'),
                COUNT(*) FILTER (WHERE status = 'DELIVERED'),
                COUNT(*) FILTER (WHERE status = 'FAILED')
            FROM shipments
        """)

        result = cur.fetchone()

        cur.execute("""
            SELECT id, restock_request_id, warehouse_id,
                   retail_id, status, created_at
            FROM shipments
            ORDER BY created_at DESC
            LIMIT 10
        """)

        shipments = cur.fetchall()
        cur.close()

        return render_template(
            "dashboard.html",
            total=result[0],
            created=result[1],
            shipped=result[2],
            delivered=result[3],
            failed=result[4],
            shipments=shipments
        )

    except Exception as e:
        return f"Database error: {e}", 500

    finally:
        if conn:
            conn.close()


# =========================
# DAFTAR SHIPMENT
# =========================
@app.route("/shipments")
def shipment_list():
    conn = None

    try:
        status = request.args.get("status", "").upper()
        retail_id = request.args.get("retail_id", "").strip()
        warehouse_id = request.args.get("warehouse_id", "").strip()

        allowed_status = [
            "CREATED", "SHIPPED", "DELIVERED", "FAILED"
        ]

        if status and status not in allowed_status:
            status = ""

        query = """
            SELECT id, restock_request_id, warehouse_id,
                   retail_id, courier_id, status, created_at
            FROM shipments
            WHERE 1=1
        """

        params = []

        if status:
            query += " AND status = %s::shipment_status"
            params.append(status)

        if retail_id:
            query += " AND retail_id::text ILIKE %s"
            params.append(f"%{retail_id}%")

        if warehouse_id:
            query += " AND warehouse_id::text ILIKE %s"
            params.append(f"%{warehouse_id}%")

        query += " ORDER BY created_at DESC"

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(query, params)
        shipments = cur.fetchall()
        cur.close()

        return render_template(
            "shipments.html",
            shipments=shipments,
            selected_status=status,
            retail_id=retail_id,
            warehouse_id=warehouse_id
        )

    except Exception as e:
        return f"Database error: {e}", 500

    finally:
        if conn:
            conn.close()


# =========================
# DETAIL SHIPMENT
# =========================
@app.route("/shipments/<shipment_id>")
def shipment_detail(shipment_id):
    conn = None

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, restock_request_id, warehouse_id,
                   retail_id, courier_id, status,
                   shipped_at, delivered_at, created_at
            FROM shipments
            WHERE id = %s
        """, (shipment_id,))

        shipment = cur.fetchone()

        if shipment is None:
            cur.close()
            return "Shipment tidak ditemukan.", 404

        cur.execute("""
            SELECT commodity_id, quantity
            FROM shipment_items
            WHERE shipment_id = %s
        """, (shipment_id,))
        items = cur.fetchall()

        cur.execute("""
            SELECT status, note, created_by, created_at
            FROM shipment_trackings
            WHERE shipment_id = %s
            ORDER BY created_at DESC
        """, (shipment_id,))
        trackings = cur.fetchall()

        cur.close()

        return render_template(
            "shipment_detail.html",
            shipment=shipment,
            items=items,
            trackings=trackings
        )

    except Exception as e:
        return f"Database error: {e}", 500

    finally:
        if conn:
            conn.close()


# =========================
# MANAJEMEN KURIR
# =========================
@app.route("/couriers")
def courier_list():
    conn = None

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                c.id,
                c.name,
                c.phone,
                c.is_active,
                COUNT(s.id) AS total_shipments
            FROM couriers c
            LEFT JOIN shipments s ON s.courier_id = c.id
            GROUP BY c.id, c.name, c.phone, c.is_active
            ORDER BY c.name
        """)

        couriers = cur.fetchall()
        cur.close()

        return render_template(
            "couriers.html",
            couriers=couriers
        )

    except Exception as e:
        return f"Database error: {e}", 500

    finally:
        if conn:
            conn.close()


# =========================
# FORM PENUGASAN KURIR
# =========================
@app.route("/shipments/<shipment_id>/assign", methods=["GET", "POST"])
def assign_courier(shipment_id):
    conn = None

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, status, courier_id
            FROM shipments
            WHERE id = %s
        """, (shipment_id,))

        shipment = cur.fetchone()

        if shipment is None:
            cur.close()
            return "Shipment tidak ditemukan.", 404

        if request.method == "POST":
            courier_id = request.form.get("courier_id")

            cur.execute("""
                SELECT id
                FROM couriers
                WHERE id = %s AND is_active = TRUE
            """, (courier_id,))

            courier = cur.fetchone()

            if courier is None:
                conn.rollback()
                cur.close()
                return "Kurir tidak ditemukan atau tidak aktif.", 400

            cur.execute("""
                UPDATE shipments
                SET courier_id = %s
                WHERE id = %s
            """, (courier_id, shipment_id))

            conn.commit()
            cur.close()

            return redirect(url_for("shipment_list"))

        cur.execute("""
            SELECT id, name, phone
            FROM couriers
            WHERE is_active = TRUE
            ORDER BY name
        """)

        couriers = cur.fetchall()
        cur.close()

        return render_template(
            "assign_courier.html",
            shipment=shipment,
            couriers=couriers
        )

    except Exception as e:
        if conn:
            conn.rollback()
        return f"Database error: {e}", 500

    finally:
        if conn:
            conn.close()

# =========================
# UPDATE STATUS SHIPMENT
# =========================
@app.route("/shipments/<shipment_id>/status", methods=["POST"])
def update_shipment_status(shipment_id):

    conn = None

    try:
        new_status = request.form.get("status", "").upper()
        note = request.form.get("note", "").strip()

        conn = get_db_connection()
        cur = conn.cursor()

        # Mengunci data shipment saat diperbarui
        cur.execute("""
            SELECT status
            FROM shipments
            WHERE id = %s
            FOR UPDATE
        """, (shipment_id,))

        shipment = cur.fetchone()

        if shipment is None:
            conn.rollback()
            return "Shipment tidak ditemukan.", 404

        current_status = str(shipment[0])

        # Validasi perubahan status
        transitions = {
            "CREATED": ["SHIPPED"],
            "SHIPPED": ["DELIVERED", "FAILED"],
            "DELIVERED": [],
            "FAILED": []
        }

        if new_status not in transitions.get(current_status, []):
            conn.rollback()
            return "Perubahan status tidak diizinkan.", 400

        # Memperbarui status shipment
        cur.execute("""
            UPDATE shipments
            SET
                status = %s::shipment_status,
                shipped_at = CASE
                    WHEN %s = 'SHIPPED'
                    THEN CURRENT_TIMESTAMP
                    ELSE shipped_at
                END,
                delivered_at = CASE
                    WHEN %s = 'DELIVERED'
                    THEN CURRENT_TIMESTAMP
                    ELSE delivered_at
                END
            WHERE id = %s
        """, (
            new_status,
            new_status,
            new_status,
            shipment_id
        ))

        # Mencatat riwayat tracking
        cur.execute("""
            INSERT INTO shipment_trackings (
                id,
                shipment_id,
                status,
                note,
                created_by
            )
            VALUES (
                gen_random_uuid(),
                %s,
                %s::shipment_status,
                %s,
                NULL
            )
        """, (
            shipment_id,
            new_status,
            note or "Status pengiriman diperbarui"
        ))

        conn.commit()
        cur.close()

        return redirect(
            url_for("shipment_detail", shipment_id=shipment_id)
        )

    except Exception as e:
        if conn:
            conn.rollback()
        return f"Database error: {e}", 500

    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    app.run(debug=True)
