    ###########################################################################
    # Traits Endpoints
    ###########################################################################
    @bp.route('/traits', methods=['GET'])
    def list_trait_categories():
        traits_dir = os.path.join(bp.config["BASE_DIR"], "traits")
        if not os.path.exists(traits_dir):
            return jsonify({'error': 'Traits folder not found'}), 404
        categories = [d for d in os.listdir(traits_dir) if os.path.isdir(os.path.join(traits_dir, d))]
        return jsonify({'categories': categories})

    @bp.route('/traits', methods=['POST'])
    def create_trait_category():
        data = request.get_json()
        category = _safe_name(data.get("category", ""))
        if not category:
            return jsonify({'error': 'Invalid category name'}), 400
        traits_dir = os.path.join(bp.config["BASE_DIR"], "traits")
        category_path = os.path.join(traits_dir, category)
        if not os.path.exists(category_path):
            os.makedirs(category_path)
            return jsonify({'message': f"Category '{category}' created successfully"}), 201
        return jsonify({'message': f"Category '{category}' already exists"}), 200

    @bp.route('/traits/<category>', methods=['GET'])
    def list_trait_images(category):
        traits_dir = os.path.join(bp.config["BASE_DIR"], "traits")
        category_path = os.path.join(traits_dir, category)
        if not os.path.exists(category_path):
            return jsonify({'error': f"Category '{category}' not found"}), 404
        
        # Pagination parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 25, type=int)
        search = request.args.get('search', '', type=str).lower()
        
        # Get all .webp files
        images = [f for f in os.listdir(category_path) 
                if os.path.isfile(os.path.join(category_path, f)) and f.lower().endswith(".webp")]
        
        # Apply search filter
        if search:
            images = [img for img in images if search in img.lower()]
        
        total_images = len(images)
        
        # Apply pagination
        start = (page - 1) * per_page
        end = start + per_page
        paginated_images = images[start:end]
        
        return jsonify({
            'images': paginated_images,
            'total': total_images,
            'page': page,
            'per_page': per_page,
            'total_pages': (total_images + per_page - 1) // per_page
        })

    @bp.route('/traits/<category>/<filename>', methods=['DELETE'])
    def delete_trait_image(category, filename):
        filename = secure_filename(filename)
        if not filename:
            return jsonify({'error': 'Invalid filename'}), 400
        traits_dir = os.path.join(bp.config["BASE_DIR"], "traits")
        category_path = os.path.join(traits_dir, category)
        file_path = os.path.join(category_path, filename)
        if os.path.exists(file_path):
            os.remove(file_path)
            return jsonify({'message': 'Trait image deleted successfully'})
        return jsonify({'error': 'Trait image not found'}), 404

    @bp.route('/traits/<category>/rename', methods=['PUT'])
    def rename_trait_image(category):
        data = request.json
        old_filename = secure_filename(data.get("oldFilename", ""))
        new_filename = secure_filename(data.get("newFilename", ""))
        if not old_filename or not new_filename:
            return jsonify({'error': 'Missing or invalid filename(s)'}), 400
        traits_dir = os.path.join(bp.config["BASE_DIR"], "traits")
        category_path = os.path.join(traits_dir, category)
        old_path = os.path.join(category_path, old_filename)
        new_path = os.path.join(category_path, new_filename)
        if not os.path.exists(old_path):
            return jsonify({'error': 'Original trait image not found'}), 404
        os.rename(old_path, new_path)
        return jsonify({'message': 'Trait image renamed successfully'})

    @bp.route('/traits/<category>/upload', methods=['POST'])
    def upload_trait_image(category):
        traits_dir = os.path.join(bp.config["BASE_DIR"], "traits")
        category_path = os.path.join(traits_dir, category)
        if not os.path.exists(category_path):
            os.makedirs(category_path)
        if 'files' not in request.files:
            if 'file' in request.files:
                file = request.files['file']
                fname = secure_filename(file.filename) if file.filename else ""
                if fname:
                    file_path = os.path.join(category_path, fname)
                    file.save(file_path)
                    # Ensure the file is written to disk
                    with open(file_path, 'rb') as f:
                        os.fsync(f.fileno())
                    return jsonify({'message': 'Trait image uploaded successfully'})
            return jsonify({'error': 'No files provided'}), 400

        files = request.files.getlist('files')
        uploaded_files = []
        for file in files:
            fname = secure_filename(file.filename) if file.filename else ""
            if fname:
                file_path = os.path.join(category_path, fname)
                file.save(file_path)
                # Ensure the file is written to disk
                with open(file_path, 'rb') as f:
                    os.fsync(f.fileno())
                uploaded_files.append(fname)
        return jsonify({
            'message': f"Uploaded {len(uploaded_files)} trait image(s) successfully",
            'files': uploaded_files
        })

    @bp.route('/traits/<category>/<path:filename>', methods=['GET'])
    def serve_trait_image(category, filename):
        return send_from_directory(os.path.join(bp.config["BASE_DIR"], "traits", category), filename)

    @bp.route('/traits-thumb/<category>/<path:filename>', methods=['GET'])
    def serve_trait_thumbnail(category, filename):
        size = request.args.get("size", 256, type=int)
        if size < 32:
            size = 32
        if size > 1024:
            size = 1024
        try:
            cache_dir, cache_name = _build_trait_thumb(bp.config["BASE_DIR"], category, filename, size)
            return send_from_directory(cache_dir, cache_name, mimetype="image/webp", max_age=86400)
        except FileNotFoundError:
            return jsonify({"error": "Trait file not found"}), 404
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except RuntimeError as e:
            return jsonify({"error": str(e)}), 502
        except Exception:
            logging.exception(f"Trait thumbnail failed for {category}/{filename}")
            return jsonify({"error": "Trait thumbnail failed"}), 500

    @bp.route('/mints', methods=['GET'])
    def get_mints():
        mints_name = _traitswap_mints_filename()
        mints_path = os.path.join(bp.config["BASE_DIR"], mints_name)
        fallback_path = bp.config["MINTS_PATH"]
        selected_path = mints_path if os.path.exists(mints_path) else fallback_path
        if os.path.exists(selected_path):
            with open(selected_path, 'r', encoding='utf-8') as f:
                mints = json.load(f)
            invalid_path = os.path.join(bp.config["BASE_DIR"], "traitswap_invalid_mints.json")
            invalid_mints = set()
            if os.path.isfile(invalid_path):
                try:
                    invalid_rows = json.load(open(invalid_path, "r", encoding="utf-8"))
                    if isinstance(invalid_rows, list):
                        invalid_mints = {str(x).strip() for x in invalid_rows if str(x).strip()}
                except Exception:
                    invalid_mints = set()
            if isinstance(mints, list) and invalid_mints:
                mints = [row for row in mints if str((row or {}).get("mint") or "").strip() not in invalid_mints]
            return jsonify(mints)
        return jsonify({'error': 'Mints file not found'}), 404

    @bp.route('/devnetmints', methods=['GET'])
    def get_devnet_mints():
        mints_name = _traitswap_mints_filename()
        mints_path = os.path.join(bp.config["BASE_DIR"], mints_name)
        if os.path.exists(mints_path):
            with open(mints_path, 'r', encoding='utf-8') as f:
                mints = json.load(f)
            invalid_path = os.path.join(bp.config["BASE_DIR"], "traitswap_invalid_mints.json")
            invalid_mints = set()
            if os.path.isfile(invalid_path):
                try:
                    invalid_rows = json.load(open(invalid_path, "r", encoding="utf-8"))
                    if isinstance(invalid_rows, list):
                        invalid_mints = {str(x).strip() for x in invalid_rows if str(x).strip()}
                except Exception:
                    invalid_mints = set()
            if isinstance(mints, list) and invalid_mints:
                mints = [row for row in mints if str((row or {}).get("mint") or "").strip() not in invalid_mints]
            return jsonify(mints)
        return jsonify({'error': f'{mints_name} file not found'}), 404

    @bp.route('/traitswap/network', methods=['GET'])
    def traitswap_network_info():
        rpc_url_raw = _traitswap_rpc_url()
        return jsonify({
            "network": _traitswap_network(),
            "rpcUrl": _traitswap_public_rpc_url(),
            "rpcHasQuery": "?" in rpc_url_raw,
            "mintsFile": _traitswap_mints_filename(),
        })

    @bp.route('/traitswap/incompatibilities', methods=['GET'])
    def get_traitswap_incompatibilities():
        try:
            return jsonify(_load_randomturtle_incompatibilities(bp.config["BASE_DIR"]))
        except Exception as e:
            logging.error(f"Failed loading randomturtle incompatibilities: {e}")
            return jsonify({"error": "Failed to load incompatibilities"}), 500

    @bp.route('/traitswap/fee-config', methods=['GET'])
    def get_traitswap_fee_config():
        fee_wallet, fee_sol, fee_lamports = _traitswap_fee_config()
        market_fee_percent = _traitswap_market_fee_percent()
        return jsonify({
            "feeEnabled": bool(fee_wallet and fee_lamports > 0),
            "feeWallet": fee_wallet,
            "feeSol": fee_sol,
            "feeLamports": fee_lamports,
            "marketplaceFeePercent": market_fee_percent,
            "marketplaceEnabled": bool(fee_wallet and market_fee_percent > 0),
        })

    @bp.route('/traitswap/config', methods=['GET'])
    def get_traitswap_config():
        try:
            return jsonify(_load_traitswap_config(bp.config["BASE_DIR"]))
        except Exception:
            logging.exception("Failed loading traitswap config")
            return jsonify({"error": "Failed loading traitswap config"}), 500

    @bp.route('/traitswap/config', methods=['POST'])
    def update_traitswap_config():
        payload = request.get_json(silent=True) or {}
        ok, reason, wallet = _require_traitswap_auth(bp.config["BASE_DIR"], payload, "config_write")
        if not ok:
            return jsonify({"error": reason}), 401
        allowed_admins = _traitswap_allowed_admin_wallets()
        if not allowed_admins:
            return jsonify({"error": "Admin wallets not configured"}), 403
        if wallet not in allowed_admins:
            return jsonify({"error": "Admin wallet not allowed"}), 403
        next_payload = payload.get("config") if isinstance(payload.get("config"), dict) else {}
        try:
            saved = _save_traitswap_config(bp.config["BASE_DIR"], next_payload)
            return jsonify({"ok": True, "config": saved})
        except Exception:
            logging.exception("Failed saving traitswap config")
            return jsonify({"error": "Failed saving traitswap config"}), 500

    @bp.route('/traitswap/vouchers', methods=['GET'])
    def get_traitswap_vouchers():
        wallet = (request.args.get("wallet") or "").strip()
        if not wallet:
            return jsonify({"error": "wallet is required"}), 400
        auth_payload = {"wallet": wallet}
        ok, reason, _ = _require_traitswap_auth(bp.config["BASE_DIR"], auth_payload, "vouchers_read")
        if not ok:
            return jsonify({"error": reason}), 401
        rows = _load_vouchers(bp.config["BASE_DIR"])
        mine = []
        for row in rows:
            if (row.get("ownerWallet") or "").strip() != wallet:
                continue
            mine.append(row)
        mine.sort(key=lambda r: str(r.get("createdAt") or ""), reverse=True)
        return jsonify(mine)

    @bp.route('/traitswap/session/start', methods=['POST'])
    def traitswap_session_start():
        payload = request.get_json(silent=True) or {}
        wallet = (payload.get("wallet") or "").strip()
        ok, reason, _ = _require_traitswap_auth(bp.config["BASE_DIR"], {"wallet": wallet}, "session_start")
        if not ok:
            return jsonify({"error": reason}), 401
        session = _create_traitswap_session(bp.config["BASE_DIR"], wallet)
        return jsonify({"ok": True, **session})

    @bp.route('/traitswap/listings', methods=['GET'])
    def get_traitswap_listings():
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        rows = _load_vouchers(bp.config["BASE_DIR"])
        listings = []
        changed = False
        for row in rows:
            if (row.get("status") or "") != "listed":
                continue
            lock_until = (row.get("lockExpiresAt") or "").strip()
            if lock_until and lock_until < now_iso:
                row["lockBuyerWallet"] = ""
                row["lockExpiresAt"] = ""
                changed = True
            listings.append(row)
        if changed:
            with _TRAITSWAP_LOCK:
                _save_vouchers(bp.config["BASE_DIR"], rows)
        listings.sort(key=lambda r: float(r.get("listedPriceSol") or 0))
        return jsonify(listings)

    @bp.route('/traitswap/voucher/gift', methods=['POST'])
    def traitswap_voucher_gift():
        payload = request.get_json(silent=True) or {}
        ok, reason, admin_wallet = _require_traitswap_auth(bp.config["BASE_DIR"], payload, "gift")
        if not ok:
            return jsonify({"error": reason}), 401
        target_wallet = (payload.get("targetWallet") or "").strip()
        layer = (payload.get("layer") or "").strip()
        value = (payload.get("value") or "").strip()
        allowed_admins = _traitswap_allowed_admin_wallets()
        if not allowed_admins:
            return jsonify({"error": "Admin wallets not configured"}), 403
        if admin_wallet not in allowed_admins:
            return jsonify({"error": "Admin wallet not allowed"}), 403
        if not target_wallet or not layer or not value:
            return jsonify({"error": "targetWallet, layer, value required"}), 400
        if _is_hidden_trait(layer, value):
            return jsonify({"error": "Trait not allowed"}), 400
        row = {
            "id": uuid.uuid4().hex,
            "ownerWallet": target_wallet,
            "layer": layer,
            "value": value,
            "status": "active",
            "source": "gift",
            "giftedByWallet": admin_wallet,
            "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        with _TRAITSWAP_LOCK:
            rows = _load_vouchers(bp.config["BASE_DIR"])
            rows.append(row)
            _save_vouchers(bp.config["BASE_DIR"], rows)
        return jsonify({"ok": True, "voucher": row})

    @bp.route('/traitswap/voucher/save', methods=['POST'])
    def traitswap_voucher_save():
        payload = request.get_json(silent=True) or {}
        ok, reason, wallet = _require_traitswap_auth(bp.config["BASE_DIR"], payload, "save")
        if not ok:
            return jsonify({"error": reason}), 401

        layer = (payload.get("layer") or "").strip()
        value = (payload.get("value") or "").strip()
        if not layer or not value:
            return jsonify({"error": "layer and value are required"}), 400
        if _is_hidden_trait(layer, value):
            return jsonify({"error": "Trait not allowed"}), 400

        server_lamports, purchasable = _traitswap_trait_price_lamports(bp.config["BASE_DIR"], layer, value)
        if not purchasable:
            return jsonify({"error": "Trait is not purchasable"}), 400

        raw_expected = payload.get("expectedLamports")
        expected_lamports = None
        if raw_expected is not None:
            try:
                expected_lamports = int(raw_expected)
            except Exception:
                return jsonify({"error": "expectedLamports must be an integer"}), 400
            if expected_lamports < 0:
                return jsonify({"error": "expectedLamports must be >= 0"}), 400

        required_lamports = server_lamports
        if required_lamports <= 0 and expected_lamports is not None:
            required_lamports = expected_lamports
        if server_lamports > 0 and expected_lamports is not None and expected_lamports != server_lamports:
            return jsonify({"error": f"Price mismatch. Expected {server_lamports} lamports"}), 400

        payment_signature = (payload.get("paymentSignature") or "").strip()
        if required_lamports > 0:
            fee_wallet, _, _ = _traitswap_fee_config()
            if not fee_wallet:
                return jsonify({"error": "Fee wallet not configured"}), 500
            if not payment_signature:
                return jsonify({"error": "paymentSignature is required"}), 400

            used_sigs = _load_used_fee_sigs(bp.config["BASE_DIR"])
            if payment_signature in used_sigs:
                return jsonify({"error": "Payment signature already used"}), 400

            fee_ok, fee_reason = _verify_fee_payment_tx(wallet, fee_wallet, required_lamports, payment_signature)
            if not fee_ok:
                return jsonify({"error": f"Fee verification failed: {fee_reason}"}), 400

        row = {
            "id": uuid.uuid4().hex,
            "ownerWallet": wallet,
            "layer": layer,
            "value": value,
            "status": "active",
            "source": "claim",
            "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        if required_lamports > 0 and payment_signature:
            row["paidLamports"] = required_lamports
            row["paymentSignature"] = payment_signature

        with _TRAITSWAP_LOCK:
            if required_lamports > 0 and payment_signature:
                used_sigs = _load_used_fee_sigs(bp.config["BASE_DIR"])
                if payment_signature in used_sigs:
                    return jsonify({"error": "Payment signature already used"}), 400
            rows = _load_vouchers(bp.config["BASE_DIR"])
            rows.append(row)
            _save_vouchers(bp.config["BASE_DIR"], rows)
            if required_lamports > 0 and payment_signature:
                _save_used_fee_sig(bp.config["BASE_DIR"], payment_signature)

        return jsonify({"ok": True, "voucher": row})

    @bp.route('/traitswap/voucher/list', methods=['POST'])
    def traitswap_voucher_list():
        payload = request.get_json(silent=True) or {}
        ok, reason, wallet = _require_traitswap_auth(bp.config["BASE_DIR"], payload, "list")
        if not ok:
            return jsonify({"error": reason}), 401
        voucher_id = (payload.get("voucherId") or "").strip()
        try:
            price_sol = float(payload.get("priceSol") or 0)
        except Exception:
            price_sol = 0.0
        if price_sol <= 0:
            return jsonify({"error": "priceSol must be > 0"}), 400
        with _TRAITSWAP_LOCK:
            rows = _load_vouchers(bp.config["BASE_DIR"])
            idx = next((i for i, r in enumerate(rows) if (r.get("id") or "") == voucher_id), -1)
            if idx < 0:
                return jsonify({"error": "Voucher not found"}), 404
            row = rows[idx]
            if (row.get("ownerWallet") or "") != wallet:
                return jsonify({"error": "Not owner"}), 403
            if (row.get("status") or "") != "active":
                return jsonify({"error": "Voucher not active"}), 400
            row["status"] = "listed"
            row["listedPriceSol"] = round(price_sol, 6)
            row["listedByWallet"] = wallet
            row["listedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            row["lockBuyerWallet"] = ""
            row["lockExpiresAt"] = ""
            rows[idx] = row
            _save_vouchers(bp.config["BASE_DIR"], rows)
        return jsonify({"ok": True, "voucher": row})

    @bp.route('/traitswap/voucher/cancel', methods=['POST'])
    def traitswap_voucher_cancel():
        payload = request.get_json(silent=True) or {}
        ok, reason, wallet = _require_traitswap_auth(bp.config["BASE_DIR"], payload, "cancel")
        if not ok:
            return jsonify({"error": reason}), 401
        voucher_id = (payload.get("voucherId") or "").strip()
        with _TRAITSWAP_LOCK:
            rows = _load_vouchers(bp.config["BASE_DIR"])
            idx = next((i for i, r in enumerate(rows) if (r.get("id") or "") == voucher_id), -1)
            if idx < 0:
                return jsonify({"error": "Voucher not found"}), 404
            row = rows[idx]
            if (row.get("ownerWallet") or "") != wallet:
                return jsonify({"error": "Not owner"}), 403
            if (row.get("status") or "") != "listed":
                return jsonify({"error": "Voucher not listed"}), 400
            row["status"] = "active"
            row["listedPriceSol"] = 0
            row["listedByWallet"] = ""
            row["listedAt"] = ""
            row["lockBuyerWallet"] = ""
            row["lockExpiresAt"] = ""
            rows[idx] = row
            _save_vouchers(bp.config["BASE_DIR"], rows)
        return jsonify({"ok": True, "voucher": row})

    @bp.route('/traitswap/voucher/transfer', methods=['POST'])
    def traitswap_voucher_transfer():
        payload = request.get_json(silent=True) or {}
        ok, reason, wallet = _require_traitswap_auth(bp.config["BASE_DIR"], payload, "transfer")
        if not ok:
            return jsonify({"error": reason}), 401
        voucher_id = (payload.get("voucherId") or "").strip()
        target_wallet = (payload.get("targetWallet") or "").strip()
        if not target_wallet:
            return jsonify({"error": "targetWallet is required"}), 400
        with _TRAITSWAP_LOCK:
            rows = _load_vouchers(bp.config["BASE_DIR"])
            idx = next((i for i, r in enumerate(rows) if (r.get("id") or "") == voucher_id), -1)
            if idx < 0:
                return jsonify({"error": "Voucher not found"}), 404
            row = rows[idx]
            if (row.get("ownerWallet") or "") != wallet:
                return jsonify({"error": "Not owner"}), 403
            if (row.get("status") or "") != "active":
                return jsonify({"error": "Voucher not active"}), 400
            row["ownerWallet"] = target_wallet
            row["listedPriceSol"] = 0
            row["listedByWallet"] = ""
            row["listedAt"] = ""
            row["lockBuyerWallet"] = ""
            row["lockExpiresAt"] = ""
            rows[idx] = row
            _save_vouchers(bp.config["BASE_DIR"], rows)
        return jsonify({"ok": True, "voucher": row})

    @bp.route('/traitswap/voucher/delete', methods=['POST'])
    def traitswap_voucher_delete():
        payload = request.get_json(silent=True) or {}
        ok, reason, wallet = _require_traitswap_auth(bp.config["BASE_DIR"], payload, "delete")
        if not ok:
            return jsonify({"error": reason}), 401
        voucher_id = (payload.get("voucherId") or "").strip()
        confirm_delete = bool(payload.get("confirmDelete"))
        confirm_delete_again = bool(payload.get("confirmDeleteAgain"))
        if not voucher_id:
            return jsonify({"error": "voucherId is required"}), 400
        if not (confirm_delete and confirm_delete_again):
            return jsonify({"error": "Double confirmation required to delete voucher"}), 400

        with _TRAITSWAP_LOCK:
            rows = _load_vouchers(bp.config["BASE_DIR"])
            idx = next((i for i, r in enumerate(rows) if (r.get("id") or "") == voucher_id), -1)
            if idx < 0:
                return jsonify({"error": "Voucher not found"}), 404
            row = rows[idx]
            if (row.get("ownerWallet") or "") != wallet:
                return jsonify({"error": "Not owner"}), 403
            if (row.get("status") or "") != "active":
                return jsonify({"error": "Only active vouchers can be deleted"}), 400
            deleted_row = dict(row)
            rows.pop(idx)
            _save_vouchers(bp.config["BASE_DIR"], rows)
        return jsonify({"ok": True, "deleted": deleted_row})

    @bp.route('/traitswap/voucher/buy', methods=['POST'])
    def traitswap_voucher_buy():
        payload = request.get_json(silent=True) or {}
        ok, reason, buyer_wallet = _require_traitswap_auth(bp.config["BASE_DIR"], payload, "buy")
        if not ok:
            return jsonify({"error": reason}), 401
        voucher_id = (payload.get("voucherId") or "").strip()
        payment_signature = (payload.get("paymentSignature") or "").strip()
        if not payment_signature:
            return jsonify({"error": "paymentSignature is required"}), 400
        with _TRAITSWAP_LOCK:
            used = _load_market_used_sigs(bp.config["BASE_DIR"])
            if payment_signature in used:
                return jsonify({"error": "Payment signature already used"}), 400

            rows = _load_vouchers(bp.config["BASE_DIR"])
            idx = next((i for i, r in enumerate(rows) if (r.get("id") or "") == voucher_id), -1)
            if idx < 0:
                return jsonify({"error": "Voucher not found"}), 404
            row = rows[idx]
            if (row.get("status") or "") != "listed":
                return jsonify({"error": "Voucher not listed"}), 400
            seller = (row.get("listedByWallet") or "").strip()
            owner = (row.get("ownerWallet") or "").strip()
            if not seller or seller != owner:
                return jsonify({"error": "Listing owner mismatch"}), 400
            if seller == buyer_wallet:
                return jsonify({"error": "Cannot buy your own listing"}), 400
            try:
                price_sol = float(row.get("listedPriceSol") or 0)
            except Exception:
                price_sol = 0.0
            total_lamports = int(round(price_sol * 1_000_000_000))
            if total_lamports <= 0:
                return jsonify({"error": "Invalid listing price"}), 400
            fee_wallet, _, _ = _traitswap_fee_config()
            fee_pct = _traitswap_market_fee_percent()
            if fee_pct > 0 and not fee_wallet:
                return jsonify({"error": "Marketplace fee wallet not configured"}), 500
            fee_lamports = int((total_lamports * fee_pct) // 100) if fee_wallet else 0
            seller_lamports = total_lamports - fee_lamports
            if seller_lamports <= 0:
                return jsonify({"error": "Invalid payout"}), 400

            verified, v_reason = _verify_market_payment_tx(
                buyer_wallet,
                seller,
                seller_lamports,
                fee_wallet,
                fee_lamports,
                payment_signature,
            )
            if not verified:
                return jsonify({"error": f"Payment verification failed: {v_reason}"}), 400

            row["status"] = "active"
            row["ownerWallet"] = buyer_wallet
            row["source"] = "marketplace"
            row["soldAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            row["soldToWallet"] = buyer_wallet
            row["soldPaymentSignature"] = payment_signature
            row["listedPriceSol"] = 0
            row["listedByWallet"] = ""
            row["listedAt"] = ""
            row["lockBuyerWallet"] = ""
            row["lockExpiresAt"] = ""
            rows[idx] = row
            _save_vouchers(bp.config["BASE_DIR"], rows)
            _save_market_used_sig(bp.config["BASE_DIR"], payment_signature)
        return jsonify({"ok": True, "voucher": row})

    @bp.route('/traitswap/voucher/consume', methods=['POST'])
    def traitswap_voucher_consume():
        payload = request.get_json(silent=True) or {}
        ok, reason, wallet = _require_traitswap_auth(bp.config["BASE_DIR"], payload, "consume")
        if not ok:
            return jsonify({"error": reason}), 401
        voucher_id = (payload.get("voucherId") or "").strip()
        mint = (payload.get("mint") or "").strip()
        if not mint:
            return jsonify({"error": "mint is required"}), 400
        try:
            owns = _wallet_owns_mint_devnet(wallet, mint)
        except Exception as e:
            logging.error(f"Traitswap voucher consume ownership check failed for {mint}: {e}")
            return jsonify({"error": "Ownership check failed"}), 502
        if not owns:
            return jsonify({"error": f"Wallet does not own this {_traitswap_network_label()} mint"}), 403
        with _TRAITSWAP_LOCK:
            rows = _load_vouchers(bp.config["BASE_DIR"])
            idx = next((i for i, r in enumerate(rows) if (r.get("id") or "") == voucher_id), -1)
            if idx < 0:
                return jsonify({"error": "Voucher not found"}), 404
            row = rows[idx]
            if (row.get("ownerWallet") or "") != wallet:
                return jsonify({"error": "Not owner"}), 403
            if (row.get("status") or "") != "active":
                return jsonify({"error": "Voucher not active"}), 400
            row["status"] = "used"
            row["usedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            row["usedByWallet"] = wallet
            row["usedOnMint"] = mint
            rows[idx] = row
            _save_vouchers(bp.config["BASE_DIR"], rows)
        return jsonify({"ok": True, "voucher": row})

    @bp.route('/traitswap/thumbnail/<mint>', methods=['GET'])
    def get_traitswap_thumbnail(mint):
        mint = (mint or "").strip()
        if not mint:
            return jsonify({"error": "mint is required"}), 400
        size = request.args.get("size", 320, type=int)
        if size < 64:
            size = 64
        if size > 1024:
            size = 1024
        constants_path = bp.config.get("CONSTANTS_PATH")
        try:
            _, network_mints = _load_devnet_mints_file(bp.config["BASE_DIR"])
            _, target = _find_mint_row(network_mints, mint)
            if not target:
                return jsonify({"error": f"Mint not found in {_traitswap_mints_filename()}"}), 404
            thumb_name = _build_traitswap_thumb(bp.config["BASE_DIR"], constants_path, target, mint, size)
            cache_dir = _traitswap_thumb_cache_dir(bp.config["BASE_DIR"])
            return send_from_directory(cache_dir, thumb_name, mimetype="image/webp", max_age=86400)
        except FileNotFoundError:
            return jsonify({"error": f"{_traitswap_mints_filename()} file not found"}), 404
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except RuntimeError as e:
            return jsonify({"error": str(e)}), 502
        except Exception:
            logging.exception(f"Traitswap thumbnail failed for {mint}")
            return jsonify({"error": "Thumbnail generation failed"}), 500

    @bp.route('/traitswap/prepare', methods=['POST'])
    def prepare_traitswap():
        payload = request.get_json(silent=True) or {}
        ok, reason, wallet = _require_traitswap_auth(bp.config["BASE_DIR"], payload, "prepare")
        if not ok:
            return jsonify({"error": reason}), 401
        mint = (payload.get("mint") or "").strip()
        mode = (payload.get("mode") or "swap").strip().lower()
        selected_files = payload.get("selectedFiles") or {}

        if not mint:
            return jsonify({"error": "mint is required"}), 400
        if not isinstance(selected_files, dict):
            return jsonify({"error": "selectedFiles must be an object"}), 400

        constants_path = bp.config.get("CONSTANTS_PATH")
        try:
            _, network_mints = _load_devnet_mints_file(bp.config["BASE_DIR"])
        except FileNotFoundError:
            return jsonify({"error": f"{_traitswap_mints_filename()} file not found"}), 404
        except ValueError as e:
            return jsonify({"error": str(e)}), 500
        except Exception as e:
            logging.error(f"Failed loading {_traitswap_mints_filename()}: {e}")
            return jsonify({"error": f"Failed to load {_traitswap_network_label()} mints"}), 500

        try:
            owns = _wallet_owns_mint_devnet(wallet, mint)
        except Exception as e:
            logging.error(f"Traitswap ownership check failed for {mint}: {e}")
            return jsonify({"error": "Ownership check failed"}), 502
        if not owns:
            return jsonify({"error": f"Wallet does not own this {_traitswap_network_label()} mint"}), 403

        target_idx, target = _find_mint_row(network_mints, mint)
        if target_idx < 0:
            return jsonify({"error": f"Mint not found in {_traitswap_mints_filename()}"}), 404

        core_ok, core_reason = _is_mpl_core_asset_mint(mint)
        if not core_ok:
            return jsonify({"error": core_reason}), 400

        try:
            prepared = _build_updated_mint_payload(bp.config["BASE_DIR"], constants_path, target, mint, selected_files)
            current_attrs = _attrs_map_from_list(target.get("attributes") if isinstance(target, dict) else [])
            next_attrs = _attrs_map_from_list((prepared.get("updatedMint") or {}).get("attributes"))
            valid, invalid_reason = _validate_required_trait_state(next_attrs)
            if not valid:
                return jsonify({"error": invalid_reason}), 400
            prepared["removedTraits"] = _compute_removed_traits_for_inventory(current_attrs, next_attrs)
            quote_id = _create_prepare_quote(bp.config["BASE_DIR"], wallet, mint, mode, prepared)
            return jsonify({"ok": True, "quoteId": quote_id, **prepared})
        except FileNotFoundError as e:
            return jsonify({"error": str(e)}), 400
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except RuntimeError as e:
            logging.error(f"Traitswap prepare runtime failure for {mint}: {e}")
            return jsonify({"error": str(e)}), 502
        except Exception as e:
            logging.exception(f"Traitswap prepare failed for {mint}")
            return jsonify({"error": "Prepare failed"}), 500

    @bp.route('/traitswap/finalize', methods=['POST'])
    def finalize_traitswap():
        payload = request.get_json(silent=True) or {}
        ok, reason, wallet = _require_traitswap_auth(bp.config["BASE_DIR"], payload, "finalize")
        if not ok:
            return jsonify({"error": reason}), 401

        mint = (payload.get("mint") or "").strip()
        quote_id = (payload.get("quoteId") or "").strip()
        payment_signature = (payload.get("paymentTxSignature") or "").strip()
        expected_lamports = payload.get("expectedLamports")

        if not mint:
            return jsonify({"error": "mint is required"}), 400
        if not quote_id:
            return jsonify({"error": "quoteId is required"}), 400
        if expected_lamports is None:
            return jsonify({"error": "expectedLamports is required"}), 400
        try:
            min_lamports = max(0, int(expected_lamports))
        except Exception:
            return jsonify({"error": "expectedLamports must be an integer"}), 400

        quote = _get_prepare_quote(bp.config["BASE_DIR"], quote_id)
        if not isinstance(quote, dict):
            return jsonify({"error": "quoteId is invalid or expired"}), 400
        if str(quote.get("wallet") or "") != wallet:
            return jsonify({"error": "quote wallet mismatch"}), 403
        if str(quote.get("mint") or "") != mint:
            return jsonify({"error": "quote mint mismatch"}), 400

        mode = str(quote.get("mode") or "swap").strip().lower()
        skip_supply = (mode == "randomizer")
        metadata_uri = str(quote.get("metadataUri") or "").strip()
        image_url = str(quote.get("imageUrl") or "").strip()
        updated_mint = quote.get("updatedMint") if isinstance(quote.get("updatedMint"), dict) else None
        if not metadata_uri:
            return jsonify({"error": "quote metadata missing"}), 400
        if not isinstance(updated_mint, dict):
            return jsonify({"error": "quote updated mint missing"}), 400

        fee_wallet, _, fee_lamports = _traitswap_fee_config()
        if min_lamports > 0 and not fee_wallet:
            return jsonify({"error": "Fee wallet not configured"}), 500
        if skip_supply:
            cfg = _load_traitswap_config(bp.config["BASE_DIR"])
            rnd = cfg.get("randomizer") if isinstance(cfg.get("randomizer"), dict) else {}
            try:
                randomizer_price_sol = max(0.0, float(rnd.get("priceSol") or 0.0))
            except Exception:
                randomizer_price_sol = 0.0
            randomizer_lamports = int(round(randomizer_price_sol * 1_000_000_000))
            if randomizer_lamports > 0 and min_lamports < randomizer_lamports:
                return jsonify({"error": "expectedLamports below required randomizer payment"}), 400

        required_lamports = max(int(fee_lamports or 0), min_lamports) if fee_wallet else 0
        if required_lamports > 0:
            if not payment_signature:
                return jsonify({"error": "paymentTxSignature is required"}), 400
            used_sigs = _load_used_fee_sigs(bp.config["BASE_DIR"])
            if payment_signature in used_sigs:
                return jsonify({"error": "Fee payment signature already used"}), 400
            fee_ok, fee_reason = _verify_fee_payment_tx(wallet, fee_wallet, required_lamports, payment_signature)
            if not fee_ok:
                return jsonify({"error": f"Fee verification failed: {fee_reason}"}), 400

        try:
            owns = _wallet_owns_mint_devnet(wallet, mint)
        except Exception as e:
            logging.error(f"Traitswap finalize ownership check failed for {mint}: {e}")
            return jsonify({"error": "Ownership check failed"}), 502
        if not owns:
            return jsonify({"error": f"Wallet does not own this {_traitswap_network_label()} mint"}), 403

        try:
            mints_path, network_mints = _load_devnet_mints_file(bp.config["BASE_DIR"])
            target_idx, target = _find_mint_row(network_mints, mint)
            if target_idx < 0:
                return jsonify({"error": f"Mint not found in {_traitswap_mints_filename()}"}), 404
        except Exception:
            logging.exception(f"Traitswap finalize failed loading {_traitswap_network_label()} mint for {mint}")
            return jsonify({"error": f"Failed loading {_traitswap_network_label()} mint"}), 500

        reserved_supply_keys: List[str] = []
        try:
            target_attrs = _attrs_map_from_list(target.get("attributes") if isinstance(target, dict) else [])
            next_attrs = _attrs_map_from_list(updated_mint.get("attributes"))
            valid, invalid_reason = _validate_required_trait_state(next_attrs)
            if not valid:
                return jsonify({"error": invalid_reason}), 400
            removed_traits = quote.get("removedTraits") if isinstance(quote.get("removedTraits"), list) else None
            if removed_traits is None:
                removed_traits = _compute_removed_traits_for_inventory(target_attrs, next_attrs)

            if not skip_supply:
                reserve_targets = []
                for layer, value in next_attrs.items():
                    if target_attrs.get(layer) == value:
                        continue
                    pricing_row = _traitswap_pricing_entry(bp.config["BASE_DIR"], layer, value)
                    max_supply = 0
                    if isinstance(pricing_row, dict):
                        try:
                            max_supply = max(0, int(pricing_row.get("maxSupply") or 0))
                        except Exception:
                            max_supply = 0
                    if max_supply <= 0:
                        continue
                    reserve_targets.append((_traitswap_supply_key(layer, value), max_supply, layer, value))

                if reserve_targets:
                    with _TRAITSWAP_LOCK:
                        used = _load_supply_used(bp.config["BASE_DIR"])
                        for key, max_supply, layer, value in reserve_targets:
                            consumed = int(used.get(key) or 0)
                            if consumed >= max_supply:
                                return jsonify({"error": f"Sold out: {layer}/{value}"}), 400
                        for key, _, _, _ in reserve_targets:
                            used[key] = int(used.get(key) or 0) + 1
                            reserved_supply_keys.append(key)
                        _save_supply_used(bp.config["BASE_DIR"], used)

            try:
                tx_signature = _run_backend_core_update_tx(mint, metadata_uri)
            except Exception as e:
                err = str(e)
                logging.error(f"Backend core update tx failed for {mint}: {err}")
                if "expected type [AssetAccountData]" in err or "DeserializingEmptyBufferError" in err:
                    return jsonify({"error": "Selected mint is not an MPL Core asset and cannot be trait-swapped"}), 400
                return jsonify({"error": f"On-chain update failed: {err}"}), 502

            ok, reason = _verify_update_tx_contains_keys(wallet, mint, tx_signature)
            if not ok:
                return jsonify({"error": f"On-chain verification failed: {reason}"}), 400

            next_row = dict(target)
            for key in ("attributes", "metadataUri", "image", "imageCid", "metadataCid"):
                if key in updated_mint:
                    next_row[key] = updated_mint.get(key)
            next_row["metadataUri"] = metadata_uri
            if image_url:
                next_row["image"] = image_url
            next_row["lastTraitSwapTx"] = tx_signature
            if payment_signature:
                next_row["lastTraitSwapFeeTx"] = payment_signature

            inventory_added = 0
            with _TRAITSWAP_LOCK:
                network_mints[target_idx] = next_row
                with open(mints_path, "w", encoding="utf-8") as f:
                    json.dump(network_mints, f, indent=2)
                inventory_added = _append_removed_trait_vouchers(
                    bp.config["BASE_DIR"],
                    wallet,
                    mint,
                    tx_signature,
                    removed_traits,
                )
                if payment_signature:
                    _save_used_fee_sig(bp.config["BASE_DIR"], payment_signature)
                _delete_prepare_quote(bp.config["BASE_DIR"], quote_id)

            return jsonify({
                "ok": True,
                "mint": mint,
                "txSignature": tx_signature,
                "updatedMint": next_row,
                "inventoryAdded": inventory_added,
            })
        except Exception:
            if reserved_supply_keys:
                try:
                    with _TRAITSWAP_LOCK:
                        used = _load_supply_used(bp.config["BASE_DIR"])
                        for key in reserved_supply_keys:
                            used[key] = max(0, int(used.get(key) or 0) - 1)
                        _save_supply_used(bp.config["BASE_DIR"], used)
                except Exception:
                    logging.exception("Failed rolling back reserved supply after finalize failure")
            logging.exception(f"Traitswap finalize failed for {mint}")
            return jsonify({"error": "Finalize failed"}), 500


    @bp.route('/traitswap/apply', methods=['POST'])
    def apply_traitswap_deprecated():
        return jsonify({
            "error": "Deprecated endpoint. Use /traitswap/prepare then /traitswap/finalize."
        }), 410
    @bp.route('/traits/check', methods=['GET'])
    def check_traits():
        def generate_expected_filename(s: str) -> str:
            return s.strip().replace("'", "_") + ".webp"
        traits_dir = os.path.join(bp.config["BASE_DIR"], "traits")
        missing_traits_set = set()
        if not os.path.exists(traits_dir):
            return jsonify({"error": "Traits folder not found"}), 404
        try:
            with open(bp.config["MINTS_PATH"], 'r', encoding='utf-8') as f:
                mints = json.load(f)
        except Exception as e:
            return jsonify({"error": "Could not load mints data"}), 500
        for mint in mints:
            for attribute in mint.get("attributes", []):
                trait_type = attribute.get("trait_type")
                trait_value = attribute.get("value")
                expected_filename = generate_expected_filename(trait_value)
                category_path = os.path.join(traits_dir, trait_type)
                if not os.path.exists(category_path):
                    missing_traits_set.add((trait_type, trait_value, expected_filename))
                    continue
                files = os.listdir(category_path)
                if expected_filename not in files:
                    missing_traits_set.add((trait_type, trait_value, expected_filename))
        missing_traits = [f"Missing {tt}: {tv} (expected file: {ef})" for tt, tv, ef in sorted(missing_traits_set)]
        return jsonify({"missing_traits": missing_traits})

    @bp.route('/traits/ignored', methods=['GET'])
    def get_ignored_traits():
        if os.path.exists(IGNORED_TRAIT_ERRORS_FILE):
            with open(IGNORED_TRAIT_ERRORS_FILE, "r", encoding="utf-8") as f:
                ignored = json.load(f)
                IGNORED_TRAIT_ERRORS.clear()
                IGNORED_TRAIT_ERRORS.extend(ignored)
        return jsonify({"ignored_errors": IGNORED_TRAIT_ERRORS})

    @bp.route('/traits/ignore', methods=['POST'])
    def ignore_trait_error():
        data = request.get_json()
        error_msg = data.get("error")
        if not error_msg:
            return jsonify({"error": "No error provided"}), 400
        if error_msg not in IGNORED_TRAIT_ERRORS:
            IGNORED_TRAIT_ERRORS.append(error_msg)
            with open(IGNORED_TRAIT_ERRORS_FILE, "w", encoding="utf-8") as f:
                json.dump(IGNORED_TRAIT_ERRORS, f, indent=4)
        return jsonify({"message": "Error ignored successfully", "ignored_errors": IGNORED_TRAIT_ERRORS}), 200
