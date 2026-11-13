import os, sys, json, stat, time, shutil, hashlib, sqlite3, subprocess

CONV_ID = "8f2bd4b5-d81b-4839-aa40-a5c3a5acaa6a"
TARGETS = ("antigravity ide.exe", "agy.exe", "language_server_windows_x64.exe")

def lp(p):
    ap = os.path.abspath(p)
    return ap if ap.startswith("\\\\?\\") else "\\\\?\\" + ap

def clear_readonly(func, path, exc_info):
    try:
        os.chmod(lp(path), stat.S_IWRITE)
        func(path)
    except Exception:
        pass

def sha256_file(p):
    h = hashlib.sha256()
    buf = bytearray(1048576)
    mv = memoryview(buf)
    with open(lp(p), "rb", buffering=0) as f:
        while True:
            n = f.readinto(mv)
            if not n:
                break
            h.update(mv[:n])
    return h.hexdigest()

def running_agy_pids():
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    out = subprocess.check_output(
        ["tasklist", "/FO", "CSV", "/NH"],
        text=True,
        creationflags=flags,
    )
    hits = []
    for line in out.splitlines():
        parts = [x.strip().strip('"') for x in line.split('","')]
        if len(parts) >= 2 and parts[0].lower() in TARGETS:
            hits.append((parts[0], parts[1]))
    return hits

def wait_for_exit_and_unlock(files_to_probe, max_wait=7200):
    t0 = time.time()
    while True:
        if not running_agy_pids():
            break
        if time.time() - t0 > max_wait:
            raise TimeoutError("Timed out waiting for Antigravity IDE / agy.exe to exit")
        time.sleep(0.5)
    time.sleep(1.5)
    for fp in files_to_probe:
        if not os.path.exists(fp):
            continue
        for _ in range(60):
            try:
                with open(fp, "r+b"):
                    break
            except OSError:
                time.sleep(0.5)
        else:
            raise RuntimeError(f"File still locked after exit: {fp}")

def execute_cutover(c_agy, stage_root, verify_out, wait_pids=True):
    if os.path.exists(verify_out):
        txt = open(verify_out, "r", encoding="utf-8", errors="replace").read()
        if "CUTOVER_OK" in txt:
            return txt

    conv_db = os.path.join(c_agy, "conversations", f"{CONV_ID}.db")
    sum_db = os.path.join(c_agy, "conversation_summaries.db")
    if wait_pids:
        wait_for_exit_and_unlock([conv_db, sum_db])

    manifest_path = os.path.join(stage_root, "stage_manifest.json")
    ext_db = os.path.join(stage_root, "summary_extract.db")
    manifest = json.load(open(manifest_path, "r", encoding="utf-8"))

    for rel, (exp_sz, exp_hash) in manifest.items():
        sp = os.path.join(stage_root, rel)
        if not os.path.exists(lp(sp)) or os.path.getsize(lp(sp)) != exp_sz or sha256_file(sp) != exp_hash:
            raise RuntimeError(f"Staged corruption detected: {rel}")

    for stale in (
        conv_db + "-wal",
        conv_db + "-shm",
        os.path.join(c_agy, "presence", f"{CONV_ID}.lock"),
    ):
        if os.path.exists(stale):
            os.remove(stale)

    dst_brain = os.path.join(c_agy, "brain", CONV_ID)
    if os.path.exists(lp(dst_brain)):
        shutil.rmtree(lp(dst_brain), onexc=clear_readonly)

    for rel in manifest:
        sp = os.path.join(stage_root, rel)
        dp = os.path.join(c_agy, rel)
        os.makedirs(lp(os.path.dirname(dp)), exist_ok=True)
        os.replace(lp(sp), lp(dp))

    for rel, (exp_sz, exp_hash) in manifest.items():
        dp = os.path.join(c_agy, rel)
        if not os.path.exists(lp(dp)) or os.path.getsize(lp(dp)) != exp_sz or sha256_file(dp) != exp_hash:
            raise RuntimeError(f"Destination verify fail: {rel}")

    conn = sqlite3.connect(sum_db, timeout=10.0, isolation_level=None)
    try:
        conn.execute("PRAGMA busy_timeout = 10000;")
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
        sum_cols = [r[1] for r in conn.execute("PRAGMA table_info(conversation_summaries)")]
        fts_cols = [r[1] for r in conn.execute("PRAGMA table_info(conversations_fts)")]
        cols_sql = ", ".join(f'"{c}"' for c in sum_cols)
        fcols_sql = ", ".join(f'"{c}"' for c in fts_cols)
        conn.execute("ATTACH DATABASE ? AS src;", (ext_db,))
        conn.execute("BEGIN IMMEDIATE;")
        try:
            conn.execute(
                f"INSERT OR REPLACE INTO main.conversation_summaries ({cols_sql}) SELECT {cols_sql} FROM src.conversation_summaries WHERE conversation_id = ?;",
                (CONV_ID,),
            )
            conn.execute("DELETE FROM main.conversations_fts WHERE conversation_id = ?;", (CONV_ID,))
            conn.execute(
                f"INSERT INTO main.conversations_fts ({fcols_sql}) SELECT {fcols_sql} FROM src.conversations_fts_rows WHERE conversation_id = ?;",
                (CONV_ID,),
            )
            conn.execute("COMMIT;")
        except Exception:
            if conn.in_transaction:
                conn.execute("ROLLBACK;")
            raise
        conn.execute("DETACH DATABASE src;")
        conn.execute("INSERT INTO conversations_fts(conversations_fts) VALUES('optimize');")
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
        sum_chk = conn.execute("PRAGMA integrity_check;").fetchone()[0]
        total_chats = conn.execute("SELECT COUNT(*) FROM conversation_summaries").fetchone()[0]
        row = conn.execute(
            "SELECT title, step_count, workspace_uris, status, not_fully_idle FROM conversation_summaries WHERE conversation_id = ?",
            (CONV_ID,),
        ).fetchone()
        fts_cnt = conn.execute("SELECT COUNT(*) FROM conversations_fts WHERE conversation_id = ?", (CONV_ID,)).fetchone()[0]
        m_fb = [r[0] for r in conn.execute("SELECT DISTINCT conversation_id FROM conversations_fts WHERE conversations_fts MATCH 'Firebase'")]
        m_tp = [r[0] for r in conn.execute("SELECT DISTINCT conversation_id FROM conversations_fts WHERE conversations_fts MATCH 'Tamper'")]
    finally:
        conn.close()

    if sum_chk != "ok" or not row or row[1] != 2680 or row[3] != "CASCADE_RUN_STATUS_IDLE" or row[4] != 0 or fts_cnt != 18:
        raise RuntimeError(f"Summary verify fail: chk={sum_chk} row={row} fts={fts_cnt}")
    if CONV_ID not in m_fb or CONV_ID not in m_tp:
        raise RuntimeError(f"FTS MATCH fail: fb={m_fb} tp={m_tp}")

    c2 = sqlite3.connect(f"file:{conv_db}?mode=ro", uri=True)
    try:
        db_chk = c2.execute("PRAGMA integrity_check;").fetchone()[0]
        steps_cnt = c2.execute("SELECT COUNT(*) FROM steps").fetchone()[0]
        max_idx = c2.execute("SELECT MAX(idx) FROM steps").fetchone()[0]
    finally:
        c2.close()

    if db_chk != "ok" or steps_cnt != 2680 or max_idx != 2679:
        raise RuntimeError(f"Conv DB verify fail: chk={db_chk} steps={steps_cnt} max_idx={max_idx}")

    shutil.rmtree(lp(stage_root), onexc=clear_readonly)

    report = "\n".join([
        "CUTOVER_OK",
        f"verified_files={len(manifest)}",
        f"conv_db_integrity={db_chk}",
        f"steps_count={steps_cnt}",
        f"max_idx={max_idx}",
        f"sum_db_integrity={sum_chk}",
        f"total_conversations={total_chats}",
        f"summary_row={row}",
        f"fts_rows={fts_cnt}",
        f"fts_match_firebase={CONV_ID in m_fb}",
        f"fts_match_tamper={CONV_ID in m_tp}",
        f"stage_removed={not os.path.exists(stage_root)}",
    ]) + "\n"
    with open(verify_out, "w", encoding="utf-8") as vf:
        vf.write(report)
    return report

if __name__ == "__main__":
    c_agy = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\CxAdmin\.gemini\antigravity"
    stage_root = sys.argv[2] if len(sys.argv) > 2 else os.path.join(c_agy, "_import_stage")
    verify_out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "cutover_verify.txt")
    wait_pids = "--no-wait" not in sys.argv[4:]
    try:
        print(execute_cutover(c_agy, stage_root, verify_out, wait_pids=wait_pids))
    except Exception as exc:
        err_file = verify_out + ".err.txt"
        with open(err_file, "w", encoding="utf-8") as ef:
            ef.write(repr(exc) + "\n")
        raise
