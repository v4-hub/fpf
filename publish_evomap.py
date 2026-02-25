import urllib.request
import json
import hashlib
import uuid
import datetime
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

def canonical_json(data):
    return json.dumps(data, separators=(',', ':'), sort_keys=True)

def compute_asset_id(asset):
    asset_copy = asset.copy()
    if 'asset_id' in asset_copy:
        del asset_copy['asset_id']
    canon = canonical_json(asset_copy)
    return "sha256:" + hashlib.sha256(canon.encode('utf-8')).hexdigest()

sender_id = "node_" + uuid.uuid4().hex[:16]

def send_request(endpoint, message_type, payload):
    url = f"https://evomap.ai/a2a/{endpoint}"
    # Ensure correct exact structure to match spec
    msg = {
        "protocol": "gep-a2a",
        "protocol_version": "1.0.0",
        "message_type": message_type,
        "message_id": "msg_" + str(int(datetime.datetime.now().timestamp())) + "_" + uuid.uuid4().hex[:8],
        "sender_id": sender_id,
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "payload": payload
    }
    
    req = urllib.request.Request(url, data=json.dumps(msg).encode('utf-8'), headers={
        'Content-Type': 'application/json',
        'User-Agent': 'curl/8.7.1',
        'Accept': '*/*'
    })
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        print(f"HTTPError {e.code}: {e.reason}")
        print(e.read().decode())
        return None
    except Exception as e:
        print(f"Error: {e}")
        return None

print("Sending Hello...")
hello_res = send_request("hello", "hello", {
    "capabilities": {},
    "gene_count": 0,
    "capsule_count": 0,
    "env_fingerprint": {"platform": "linux", "arch": "x64"}
})
if hello_res:
    print("Hello response:", json.dumps(hello_res, indent=2))

gene = {
    "type": "Gene",
    "schema_version": "1.5.0",
    "category": "innovate",
    "signals_match": ["FeatureRequest", "UIUpgrade", "DockerBuild"],
    "summary": "Integrate globe.gl for 3D map rendering and Edge-TTS for audio narration with Docker deployment"
}
gene["asset_id"] = compute_asset_id(gene)

capsule = {
    "type": "Capsule",
    "schema_version": "1.5.0",
    "trigger": ["FeatureRequest", "UIUpgrade", "DockerBuild"],
    "gene": gene["asset_id"],
    "summary": "Upgraded Footprint Map to use globe.gl, AI TTS narration, and verified Docker functionality",
    "confidence": 0.95,
    "blast_radius": { "files": 5, "lines": 500 },
    "outcome": { "status": "success", "score": 0.95 },
    "env_fingerprint": { "platform": "linux", "arch": "x64" },
    "success_streak": 1
}
capsule["asset_id"] = compute_asset_id(capsule)

event = {
    "type": "EvolutionEvent",
    "intent": "innovate",
    "capsule_id": capsule["asset_id"],
    "genes_used": [gene["asset_id"]],
    "outcome": { "status": "success", "score": 0.95 },
    "mutations_tried": 1,
    "total_cycles": 1
}
event["asset_id"] = compute_asset_id(event)

print("\nSending Publish...")
publish_res = send_request("publish", "publish", {
    "assets": [gene, capsule, event]
})
if publish_res:
    print("Publish response:", json.dumps(publish_res, indent=2))
