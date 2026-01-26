"""**LSTM Model 1 **"""

import torch
import torch.nn as nn
import torch.nn.functional as F

# Attention is a defined architecture
class Attention(nn.Module):
    def __init__(self, hidden_dim):
        super(Attention, self).__init__()
        # Transforms hidden states to calculate attention scores
        self.attn = nn.Linear(hidden_dim, 1)

    def forward(self, lstm_output):
        # lstm_output shape: (Batch, Seq_Len, Hidden_Dim)

        # Calculate scores for each time step
        # shape: (Batch, Seq_Len, 1)
        attn_weights = F.softmax(self.attn(lstm_output), dim=1)

        # Multiply weights by the actual LSTM outputs
        # shape: (Batch, Hidden_Dim)
        context_vector = torch.sum(attn_weights * lstm_output, dim=1)

        return context_vector, attn_weights

# The main class that is calling Attention
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
        # Input dim is hidden_size * 2 because of bidirectionality
        self.attention = Attention(hidden_size * 2)

        # 4. Classifier
        self.fc = nn.Linear(hidden_size * 2, num_classes)

    # The main function call that runs the EmotionClassifier
    def forward(self, x):
        # x: (Batch, 352, 15)

        # Normalize inputs immediately
        x = self.layer_norm(x)

        # LSTM output: (Batch, 352, hidden_size*2)
        lstm_out, _ = self.lstm(x)

        # Instead of taking the last step (lstm_out[:, -1, :]),
        # we use attention to pool all steps
        context_vector, _ = self.attention(lstm_out)

        logits = self.fc(context_vector)
        return logits