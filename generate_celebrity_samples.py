import os
import sys
import sqlite3
import asyncio
import uuid
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from api import ai_utils
from celebrity_data import CELEBRITIES

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'footprint_map.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def clean_database(conn, user_id):
    conn.execute("DELETE FROM journey_points WHERE journey_id IN (SELECT id FROM journeys WHERE user_id = ?)", (user_id,))
    conn.execute("DELETE FROM journeys WHERE user_id = ?", (user_id,))
    conn.commit()
    print("清理了旧的样本数据。")

async def process_celebrity(celeb, user_id):
    name = celeb["name"]
    print(f"[{name}] 开始生成定制足迹...")
    conn = get_db_connection()
    try:
        cursor = conn.execute('''
            INSERT INTO journeys (user_id, title, description, visibility, view_count, created_at, updated_at)
            VALUES (?, ?, ?, 'public', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ''', (user_id, celeb["title"], celeb["description"], len(celeb["points"]) * 10))
        journey_id = cursor.lastrowid
        points = celeb["points"]
        for i, point in enumerate(points):
            location = point['location']
            content = point['content']
            tts_text = f"{location}。{content}"
            audio_filename = f"tts_{journey_id}_{i}_{uuid.uuid4().hex[:6]}.mp3"
            print(f"  [{i+1}/{len(points)}] {location}")
            audio_url = None
            try:
                audio_url = await ai_utils.generate_tts_audio(tts_text, audio_filename)
            except Exception as e:
                print(f"  TTS失败: {e}")
            conn.execute('''
                INSERT INTO journey_points (journey_id, location, time, exact_date, latitude, longitude, content, order_index, audio_url, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ''', (journey_id, location, point.get('time'), point.get('date'),
                  point.get('lat'), point.get('lon'), content, i, audio_url))
        conn.commit()
        print(f"[{name}] 完成 ({len(points)} 个足迹点)")
        return True
    except Exception as e:
        conn.rollback()
        print(f"[{name}] 错误: {e}")
        return False
    finally:
        conn.close()

async def main():
    conn = get_db_connection()
    user_row = conn.execute("SELECT id FROM users LIMIT 1").fetchone()
    if not user_row:
        import hashlib
        pwd = hashlib.sha256("admin123".encode()).hexdigest()
        cursor = conn.execute('''
            INSERT INTO users (username, email, password_hash, role, is_active, created_at, updated_at)
            VALUES ('AI_Curator', 'ai@perspective.app', ?, 'admin', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ''', (pwd,))
        user_id = cursor.lastrowid
        conn.commit()
    else:
        user_id = user_row['id']
    clean_database(conn, user_id)
    conn.close()
    print(f"User ID {user_id} | {len(CELEBRITIES)} celebrities | generating...")
    for celeb in CELEBRITIES:
        await process_celebrity(celeb, user_id)
    print(f"\n完成！共 {len(CELEBRITIES)} 个名人足迹已写入数据库。")

if __name__ == "__main__":
    asyncio.run(main())
