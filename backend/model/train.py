import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
import os

# correct path for saving data
data_path = os.path.join(os.path.dirname(__file__), "../data/data.csv")

# 1. Data fetch
data = yf.download("AAPL", start="2020-01-01", end="2024-01-01")

# check if data empty
if data.empty:
    print("Data download failed ❌")
    exit()

data = data[['Close']]

# save data properly
data.to_csv(data_path)

# 2. Scaling
scaler = MinMaxScaler(feature_range=(0,1))
scaled_data = scaler.fit_transform(data)

# 3. Dataset create
X, y = [], []
for i in range(60, len(scaled_data)):
    X.append(scaled_data[i-60:i])
    y.append(scaled_data[i])

X, y = np.array(X), np.array(y)

# 4. Model
model = Sequential()
model.add(LSTM(50, return_sequences=True, input_shape=(X.shape[1], 1)))
model.add(LSTM(50))
model.add(Dense(1))

model.compile(optimizer='adam', loss='mse')

# 5. Train
model.fit(X, y, epochs=5, batch_size=32)

# 6. Save model
model_path = os.path.join(os.path.dirname(__file__), "lstm_model.h5")
model.save(model_path)

print("Model trained & saved ✅")