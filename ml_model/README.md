# ML Model Export Guide

This guide explains how to convert the PyTorch emotion classification models to TensorFlow.js for browser-based inference.

## Model Information

| Model | File | Accuracy | Use Case |
|-------|------|----------|----------|
| Female | `best_model_female_best.pt` | 88% | Best for female voices |
| Male | `best_model_male_best.pt` | 68% | Best for male voices |
| Combined | `best_model_full_best.pt` | ~60% | Gender-neutral fallback |

### Input/Output Specifications

- **Input Shape**: `(batch_size, 352, 15)`
  - 352 time steps (from ~8 seconds of audio at 22050 Hz with hop_length=512)
  - 15 features per time step: ZCR (1) + RMS (1) + MFCCs (13)
  
- **Output Shape**: `(batch_size, 6)`
  - 6 emotion classes: angry, disgust, fear, happy, sad, neutral

### Emotion Mapping

```javascript
const EMOTION_MAP = {
  0: 'angry',
  1: 'disgust', 
  2: 'fear',
  3: 'happy',
  4: 'sad',
  5: 'neutral'
};
```

## Step 1: Export to ONNX

First, run the export script to convert PyTorch models to ONNX format:

```bash
cd ml_model
pip install torch onnx
python export_to_onnx.py
```

This creates ONNX files in `public/models/onnx/`.

## Step 2: Convert ONNX to TensorFlow.js

Install the converter:

```bash
pip install tensorflowjs onnx-tf
```

Convert each model:

```bash
# Female model (most accurate)
tensorflowjs_converter --input_format=onnx \
  ../public/models/onnx/emotion_female.onnx \
  ../public/models/tfjs/female/

# Male model
tensorflowjs_converter --input_format=onnx \
  ../public/models/onnx/emotion_male.onnx \
  ../public/models/tfjs/male/

# Combined model (fallback)
tensorflowjs_converter --input_format=onnx \
  ../public/models/onnx/emotion_combined.onnx \
  ../public/models/tfjs/combined/
```

## Step 3: Verify the Output

After conversion, you should have this structure:

```
public/
└── models/
    └── tfjs/
        ├── female/
        │   ├── model.json
        │   └── group1-shard1of1.bin
        ├── male/
        │   ├── model.json
        │   └── group1-shard1of1.bin
        └── combined/
            ├── model.json
            └── group1-shard1of1.bin
```

## Feature Extraction Requirements

For the model to work correctly, the browser-side feature extraction must match the training parameters:

| Parameter | Value |
|-----------|-------|
| Sample Rate | 22050 Hz |
| Hop Length | 512 samples |
| Frame Length | 2048 samples |
| Number of MFCCs | 13 |
| Target Sequence Length | 352 frames |

## Troubleshooting

### "Model architecture mismatch" error

Ensure the `EmotionClassifier` class in `export_to_onnx.py` exactly matches the architecture used during training.

### ONNX conversion fails

Try updating opset version in `export_to_onnx.py`:
```python
opset_version=12  # or 13
```

### TensorFlow.js conversion fails

Try the alternative ONNX-to-TF-to-TFJS pipeline:
```bash
pip install onnx-tf tensorflow
python -c "import onnx; from onnx_tf.backend import prepare; prepare(onnx.load('model.onnx')).export_graph('saved_model')"
tensorflowjs_converter --input_format=tf_saved_model saved_model/ tfjs_model/
```
