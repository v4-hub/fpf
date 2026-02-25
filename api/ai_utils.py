# api/ai_utils.py
import wikipedia
import edge_tts
import asyncio
import os
import re
from geopy.geocoders import Nominatim
from datetime import datetime

# Set language for wikipedia
wikipedia.set_lang("zh")

# Geocoder setup
geolocator = Nominatim(user_agent="footprint_map_ai_agent")

async def generate_tts_audio(text, output_filename):
    """
    Generate TTS audio using edge-tts
    """
    voice = "zh-CN-XiaoxiaoNeural"  # Default Chinese voice
    # Ensure audio directory exists
    audio_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'audio')
    os.makedirs(audio_dir, exist_ok=True)
    
    file_path = os.path.join(audio_dir, output_filename)
    
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(file_path)
    
    # Return relative path to be accessible via web
    return f"assets/audio/{output_filename}"

def extract_years_and_locations(text):
    """
    Basic heuristic extractor for years and potential locations from text.
    In a real AI scenario, this would use an LLM or NER model.
    """
    results = []
    # simplistic split by sentence
    sentences = re.split(r'[。！？]', text)
    
    for sentence in sentences:
        if not sentence.strip():
            continue
            
        # Look for years
        year_match = re.search(r'([1-2][0-9]{3})年', sentence)
        if year_match:
            year = year_match.group(1)
            # Try to find a location proxy (basic keyword matching or just geocoding nouns)
            # Simplified approach: grab words before specific location indicators or just send the sentence part to geocoder.
            # A more robust offline way without API key: just pick 3-4 famous cities associated with them.
            results.append({
                "year": year,
                "context": sentence.strip() + "。"
            })
            
    return results

def generate_celebrity_footprints(name):
    """
    Uses Wikipedia to generate a simulated footprint map for a celebrity.
    """
    try:
        # Fetch summary from Wikipedia
        summary = wikipedia.summary(name, sentences=10)
        
        # We need to extract locations. Since strictly parsing text for locations 
        # is complex without NLP models, we will do a simplified extraction:
        # If we can't find explicitly clear location, we'll try to find known cities in their summary.
        known_cities = ["北京", "上海", "广州", "深圳", "香港", "台北", "纽约", "巴黎", "伦敦", "东京", "洛杉矶", "旧金山"]
        
        points = []
        year = datetime.now().year - 50 # Start roughly 50 yrs ago
        order = 0
        
        sentences = re.split(r'[。！？]', summary)
        
        for sentence in sentences:
            if not sentence: continue
            
            # Check for city mentions
            found_city = None
            for city in known_cities:
                if city in sentence:
                    found_city = city
                    break
            
            if not found_city:
                # Fallback: Check if there's a 2-4 char noun that could be a place (very naive)
                # For demo purposes, we will just use a few reliable locations if none found.
                continue
                
            try:
                location = geolocator.geocode(found_city, timeout=10)
                if location:
                    # Extract year if possible
                    year_match = re.search(r'([1-2][0-9]{3})年', sentence)
                    display_time = f"{year_match.group(1)}年" if year_match else f"{year}年"
                    
                    points.append({
                        "location": found_city,
                        "latitude": location.latitude,
                        "longitude": location.longitude,
                        "time": display_time,
                        "date": f"{display_time[:4]}/1/1",
                        "content": sentence.strip() + "。",
                        "order_index": order
                    })
                    order += 1
                    year += 2
            except Exception as e:
                print(f"[WARN] Geocoding failed for {found_city}: {e}")
                
        # If we didn't find any points, add a default fallback one so it doesn't fail completely
        if not points:
            try:
                location = geolocator.geocode("北京", timeout=10)
                points.append({
                    "location": "北京",
                    "latitude": location.latitude,
                    "longitude": location.longitude,
                    "time": "生平",
                    "date": "2000/1/1",
                    "content": f"{name}的生平记录主要基于公开资料。",
                    "order_index": 0
                })
            except:
                points.append({
                    "location": "未知位置",
                    "latitude": 39.9,
                    "longitude": 116.4,
                    "time": "未知",
                    "date": "2000/1/1",
                    "content": f"无法提取明确地理信息。",
                    "order_index": 0
                })
                
        return {
            "title": f"{name} 生平足迹",
            "description": f"由 AI 自动摘录的 {name} 的全球生平足迹。",
            "points": points
        }
        
    except wikipedia.exceptions.DisambiguationError as e:
        return {"error": f"名字存在歧义，可能指的是：{', '.join(e.options[:5])}"}
    except wikipedia.exceptions.PageError:
        return {"error": "未找到相关人物资料。"}
    except Exception as e:
        return {"error": f"生成足迹时发生错误: {str(e)}"}

# For testing locally
if __name__ == "__main__":
    test_result = generate_celebrity_footprints("周杰伦")
    print(test_result)
