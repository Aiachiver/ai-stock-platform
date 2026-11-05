"""Unit tests for the chronological probability calibration wrapper."""
import unittest

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

from advanced_engine import _TemporalCalibratedModel


class TemporalCalibrationTests(unittest.TestCase):
    def test_fit_and_probability_output(self):
        rng = np.random.default_rng(42)
        x_values = rng.normal(size=(300, 3))
        logits = 1.2 * x_values[:, 0] - 0.7 * x_values[:, 1]
        y_values = (logits + rng.normal(scale=0.7, size=300) > 0).astype(int)
        x = pd.DataFrame(x_values, columns=["momentum", "volatility", "volume"])
        y = pd.Series(y_values)

        model = _TemporalCalibratedModel(
            LogisticRegression(max_iter=1000, random_state=42)
        ).fit(x, y)
        probabilities = model.predict_proba(x.iloc[-10:])

        self.assertEqual(probabilities.shape, (10, 2))
        self.assertTrue(np.isfinite(probabilities).all())
        self.assertTrue((probabilities >= 0).all())
        self.assertTrue((probabilities <= 1).all())
        np.testing.assert_allclose(probabilities.sum(axis=1), 1.0, atol=1e-8)

    def test_rejects_insufficient_calibration_window(self):
        x = pd.DataFrame({"x": np.arange(80, dtype=float)})
        y = pd.Series([0, 1] * 40)
        model = _TemporalCalibratedModel(LogisticRegression())
        with self.assertRaises(ValueError):
            model.fit(x, y)


if __name__ == "__main__":
    unittest.main()
