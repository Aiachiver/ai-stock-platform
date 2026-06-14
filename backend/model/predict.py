import numpy as np
import pandas as pd
import yfinance as yf
from tensorflow.keras.models import load_model
from sklearn.preprocessing import MinMaxScaler
import os

# ✅ Base path
BASE_DIR = os.path.dirname(__file__)

# ✅ Paths
model_path = os.path.join(BASE_DIR, "lstm_model.h5")
data_path = os.path.join(BASE_DIR, "../data/data.csv")

# ✅ Load model once (important)
model = load_model(model_path, compile=False)


def predict_price(symbol=None):
    try:
        print("\n===== START =====")

        # =========================
        # STEP 1: LOAD DATA
        # =========================
        if symbol:
            print(f"Fetching LIVE data for {symbol}...")
            data = yf.download(symbol, period="60d")

            if data.empty:
                return {"error": "Invalid stock symbol or no data found"}

            data = data[['Close']]

        else:
            print("Using CSV data...")
            data = pd.read_csv(data_path)

            if 'Close' not in data.columns:
                return {"error": "CSV must contain 'Close' column"}

            data = data[['Close']]

        print("Data Loaded:", data.shape)

        # =========================
        # STEP 2: SCALING
        # =========================
        scaler = MinMaxScaler(feature_range=(0, 1))
        scaled_data = scaler.fit_transform(data)

        if len(scaled_data) < 60:
            return {"error": "Need at least 60 rows of data"}

        # =========================
        # STEP 3: PREPARE INPUT
        # =========================
        last_60_days = scaled_data[-60:]
        last_60_days = np.reshape(last_60_days, (1, 60, 1))

        print("Input shape:", last_60_days.shape)

        # =========================
        # STEP 4: PREDICTION
        # =========================
        prediction = model.predict(last_60_days)

        # Reverse scaling
        prediction = scaler.inverse_transform(prediction)
        predicted_price = float(prediction.flatten()[0])

        # =========================
        # STEP 5: CURRENT PRICE
        # =========================
        current_price = float(data['Close'].values[-1][0])

        # =========================
        # STEP 6: SIGNAL LOGIC
        # ========================
        if predicted_price > current_price * 1.01:
             signal = "BUY 📈"
        elif predicted_price < current_price * 0.99:
             signal = "SELL 📉"
        else:
             signal = "HOLD ⏸️"

        print("Current:", current_price)
        print("Predicted:", predicted_price)
        print("Signal:", signal)

        print("===== END =====\n")

        # =========================
        # FINAL RESPONSE
        # =========================
        return {
            "current_price": round(current_price, 2),
            "predicted_price": round(predicted_price, 2),
            "signal": signal
        }

    except Exception as e:
        print("❌ ERROR:", e)
        return {"error": str(e)}