from flask import Flask, jsonify
from flask_cors import CORS
import pandas as pd

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route('/api/telemetry')
def get_telemetry():
    # Lê o arquivo CSV, pulando a linha de unidades (segunda linha)
    df = pd.read_csv('dados.csv', skiprows=[1])
    # Remove valores NaN para evitar problemas no JSON
    data = df.fillna('').to_dict(orient='records')
    return jsonify(data)

if __name__ == '__main__':
    app.run(debug=True) 