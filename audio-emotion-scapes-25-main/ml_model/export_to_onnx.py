"""
Export PyTorch Emotion Classifier to ONNX format for web deployment.

This script loads the trained model checkpoints and exports them to ONNX format,
which can then be converted to TensorFlow.js for browser-based inference.

Usage:
    python export_to_onnx.py

Requirements:
    pip install torch onnx
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import os

# ============================================================================
# Model Architecture (must match the training code exactly)
# ============================================================================

class Attention(nn.Module):
    def __init__(self, hidden_dim):
        super(Attention, self).__init__()
        self.attn = nn.Linear(hidden_dim, 1)

    def forward(self, lstm_output):
        # lstm_output shape: (Batch, Seq_Len, Hidden_Dim)
        attn_weights = F.softmax(self.attn(lstm_output), dim=1)
        context_vector = torch.sum(attn_weights * lstm_output, dim=1)
        return context_vector


class EmotionClassifier(nn.Module):
    def __init__(self, input_size=15, hidden_size=64, num_classes=6):
        super().__init__()
        
        # 1. Norm Layer to handle the ZCR vs MFCC scale difference
        self.layer_norm = nn.LayerNorm(input_size)
        
        # 2. Bidirectional LSTM
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=2,
            batch_first=True,
            bidirectional=True,
            dropout=0.3
        )
        
        # 3. Attention Mechanism
        self.attention = Attention(hidden_size * 2)
        
        # 4. Classifier
        self.fc = nn.Linear(hidden_size * 2, num_classes)

    def forward(self, x):
        # x: (Batch, 352, 15)
        x = self.layer_norm(x)
        lstm_out, _ = self.lstm(x)
        context_vector = self.attention(lstm_out)
        logits = self.fc(context_vector)
        return logits


# ============================================================================
# Export Functions
# ============================================================================

def load_model(checkpoint_path: str) -> EmotionClassifier:
    """Load a trained model from checkpoint."""
    model = EmotionClassifier(input_size=15, hidden_size=64, num_classes=6)
    
    # Load state dict
    state_dict = torch.load(checkpoint_path, map_location=torch.device('cpu'))
    model.load_state_dict(state_dict)
    model.eval()
    
    print(f"Loaded model from: {checkpoint_path}")
    return model


def export_to_onnx(model: EmotionClassifier, output_path: str, model_name: str):
    """Export PyTorch model to ONNX format."""
    
    # Create dummy input matching the expected shape: (batch, seq_len, features)
    # seq_len = 352 (from training), features = 15 (ZCR + RMS + 13 MFCCs)
    dummy_input = torch.randn(1, 352, 15)
    
    # Export to ONNX
    onnx_path = os.path.join(output_path, f"{model_name}.onnx")
    
    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        export_params=True,
        opset_version=11,
        do_constant_folding=True,
        input_names=['input'],
        output_names=['output'],
        dynamic_axes={
            'input': {0: 'batch_size'},
            'output': {0: 'batch_size'}
        }
    )
    
    print(f"Exported ONNX model to: {onnx_path}")
    return onnx_path


def main():
    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    checkpoints_dir = os.path.join(script_dir, '..', 'checkpoints')
    output_dir = os.path.join(script_dir, '..', 'public', 'models', 'onnx')
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Model configurations
    models_to_export = [
        ('best_model_female_best.pt', 'emotion_female'),
        ('best_model_male_best.pt', 'emotion_male'),
        ('best_model_full_best.pt', 'emotion_combined'),
    ]
    
    print("=" * 60)
    print("Exporting Emotion Classifier Models to ONNX")
    print("=" * 60)
    
    for checkpoint_name, model_name in models_to_export:
        checkpoint_path = os.path.join(checkpoints_dir, checkpoint_name)
        
        if not os.path.exists(checkpoint_path):
            print(f"WARNING: Checkpoint not found: {checkpoint_path}")
            continue
        
        print(f"\nProcessing: {checkpoint_name}")
        print("-" * 40)
        
        # Load and export
        model = load_model(checkpoint_path)
        export_to_onnx(model, output_dir, model_name)
    
    print("\n" + "=" * 60)
    print("Export Complete!")
    print("=" * 60)
    print(f"\nONNX models saved to: {output_dir}")
    print("\nNext step: Convert ONNX to TensorFlow.js using:")
    print("  pip install tensorflowjs")
    print("  tensorflowjs_converter --input_format=onnx \\")
    print("    public/models/onnx/emotion_female.onnx \\")
    print("    public/models/tfjs/female/")


if __name__ == "__main__":
    main()
