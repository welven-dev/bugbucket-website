import re
from pathlib import Path
import joblib
from flask import Flask, request, jsonify
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

BASE = Path(__file__).parent
model = joblib.load(BASE / 'bugbucket_model.joblib')            # renamed to match your uploaded files
vectorizer = joblib.load(BASE / 'bugbucket_vectorizer.joblib')

keep = {'full', 'down', 'up', 'top', 'bottom', 'front', 'back', 'side', 'system', 'empty'}
extra = {'doesn', 'don', 'isn', 'didn', 'wasn', 'aren', 'weren', 'couldn',
         'wouldn', 'shouldn', 'hasn', 'haven', 'hadn', 'won', 'll', 've', 're'}
stop = (set(ENGLISH_STOP_WORDS) - keep) | extra

def clean(text):
    text = text.lower()
    text = re.sub(r'http\S+|www\.\S+', ' ', text)
    text = re.sub(r'[^a-z]+', ' ', text)
    words = [w for w in text.split() if len(w) > 1 and w not in stop]
    return ' '.join(words)

# One Flask app serves both the website (../website) and the /predict API,
# so the whole project lives behind a single link.
app = Flask(__name__, static_folder=str(BASE.parent / 'website'), static_url_path='')

@app.route('/')
def home():
    return app.send_static_file('index.html')

@app.after_request
def allow_website(response):          # lets the HTML pages call this server (CORS)
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json(silent=True) or {}
    text = str(data.get('text', data.get('title', ''))).strip()
    if len(text) > 2000:
        return jsonify({'error': 'Report is longer than 2000 characters.'}), 400
    # The model was trained on short titles (max 255 chars), so use only the start.
    cleaned = clean(text[:255])
    if cleaned == '':
        return jsonify({'error': 'No usable words found. Describe the bug in a few words.'}), 400
    probs = model.predict_proba(vectorizer.transform([cleaned]))[0]
    percentages = {c: round(float(p) * 100, 2) for c, p in zip(model.classes_, probs)}
    return jsonify({'category': max(percentages, key=percentages.get), 'percentages': percentages})

if __name__ == '__main__':
    app.run(port=5000)
