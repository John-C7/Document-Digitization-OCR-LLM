import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image
import os
import numpy as np

# Define character set (adjust based on your prefix_tree or requirements)
CHAR_SET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,-!?' "
CHAR_TO_INT = {c: i + 1 for i, c in enumerate(CHAR_SET)}  # 0 reserved for CTC blank
INT_TO_CHAR = {i + 1: c for i, c in enumerate(CHAR_SET)}
NUM_CLASSES = len(CHAR_SET) + 1  # +1 for blank

# Define the CNN-RNN-CTC model
class RCNNCTCModel(nn.Module):
    def __init__(self, num_classes, img_height=64, img_width=512):
        super(RCNNCTCModel, self).__init__()
        # CNN for feature extraction
        self.cnn = nn.Sequential(
            nn.Conv2d(1, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),  # (32, 256)
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),  # (16, 128)
            nn.Conv2d(128, 256, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.BatchNorm2d(256),
            nn.Conv2d(256, 256, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d((2, 1)),  # (8, 128)
            nn.Conv2d(256, 512, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.BatchNorm2d(512),
            nn.MaxPool2d((2, 1)),  # (4, 128)
        )
        # RNN for sequence modeling
        self.rnn = nn.LSTM(512 * 4, 256, num_layers=2, bidirectional=True, batch_first=False)
        # Fully connected layer
        self.fc = nn.Linear(256 * 2, num_classes)  # 512 due to bidirectionality

    def forward(self, x):
        # x: (batch, 1, height, width)
        features = self.cnn(x)  # (batch, channels, h, w)
        # Reshape for RNN: (w, batch, channels * h)
        batch_size = features.size(0)
        features = features.permute(3, 0, 1, 2)  # (w, batch, channels, h)
        features = features.reshape(features.size(0), batch_size, -1)  # (w, batch, features)
        # RNN
        output, _ = self.rnn(features)  # (w, batch, 512)
        # FC
        output = self.fc(output)  # (w, batch, num_classes)
        return output  # CTC expects (T, N, C)

# IAM Dataset class
class IAMDataset(Dataset):
    def __init__(self, root_dir, split='train', transform=None):
        self.root_dir = root_dir
        self.transform = transform
        self.lines_dir = os.path.join(root_dir, 'lines')
        self.split = split

        # Load transcriptions from lines.txt
        self.data = []
        with open(os.path.join(root_dir, 'ascii', 'lines.txt'), 'r') as f:
            lines = f.readlines()
            for line in lines:
                if line.startswith('#') or not line.strip():
                    continue
                parts = line.strip().split()
                img_id = parts[0]
                transcription = ' '.join(parts[8:]).replace('|', ' ')
                img_path = os.path.join(self.lines_dir, img_id[:3], img_id[:7], f"{img_id}.png")
                if os.path.exists(img_path):
                    self.data.append((img_path, transcription))

        # Simple split (e.g., 80% train, 20% val/test)
        np.random.seed(42)
        indices = np.random.permutation(len(self.data))
        train_size = int(0.8 * len(self.data))
        if split == 'train':
            self.data = [self.data[i] for i in indices[:train_size]]
        else:
            self.data = [self.data[i] for i in indices[train_size:]]

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        img_path, transcription = self.data[idx]
        image = Image.open(img_path).convert('L')  # Grayscale
        if self.transform:
            image = self.transform(image)
        # Encode transcription
        label = [CHAR_TO_INT[c] for c in transcription if c in CHAR_TO_INT]
        return image, torch.tensor(label, dtype=torch.long)

# Collate function for variable-length sequences
def collate_fn(batch):
    images, labels = zip(*batch)
    images = torch.stack(images, dim=0)
    label_lengths = torch.tensor([len(label) for label in labels], dtype=torch.long)
    labels = torch.cat(labels)
    return images, labels, label_lengths

# Define transforms
IMG_HEIGHT, IMG_WIDTH = 64, 512
transform = transforms.Compose([
    transforms.Resize((IMG_HEIGHT, IMG_WIDTH)),
    transforms.ToTensor(),
    transforms.Normalize((0.5,), (0.5,))
])

# Training function
def train_model(model, train_loader, val_loader, num_epochs=50, device='cuda'):
    model.to(device)
    criterion = nn.CTCLoss(blank=0, zero_infinity=True)
    optimizer = optim.Adam(model.parameters(), lr=0.0001)
    best_loss = float('inf')

    for epoch in range(num_epochs):
        model.train()
        train_loss = 0
        for images, targets, target_lengths in train_loader:
            images = images.to(device)
            targets = targets.to(device)
            target_lengths = target_lengths.to(device)

            optimizer.zero_grad()
            outputs = model(images)  # (T, N, C)
            outputs = outputs.log_softmax(2)  # CTC expects log probs
            input_lengths = torch.full((images.size(0),), outputs.size(0), dtype=torch.long, device=device)
            loss = criterion(outputs, targets, input_lengths, target_lengths)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()

        train_loss /= len(train_loader)
        print(f"Epoch {epoch+1}/{num_epochs}, Train Loss: {train_loss:.4f}")

        # Validation
        model.eval()
        val_loss = 0
        with torch.no_grad():
            for images, targets, target_lengths in val_loader:
                images = images.to(device)
                targets = targets.to(device)
                target_lengths = target_lengths.to(device)
                outputs = model(images)
                outputs = outputs.log_softmax(2)
                input_lengths = torch.full((images.size(0),), outputs.size(0), dtype=torch.long, device=device)
                loss = criterion(outputs, targets, input_lengths, target_lengths)
                val_loss += loss.item()
        val_loss /= len(val_loader)
        print(f"Validation Loss: {val_loss:.4f}")

        if val_loss < best_loss:
            best_loss = val_loss
            torch.save(model.state_dict(), 'best_rcnn_ctc.pth')

# Main execution
def main():
    # Device setup
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")

    # Data loading
    train_dataset = IAMDataset(root_dir='iam_dataset', split='train', transform=transform)
    val_dataset = IAMDataset(root_dir='iam_dataset', split='val', transform=transform)
    train_loader = DataLoader(train_dataset, batch_size=16, shuffle=True, collate_fn=collate_fn)
    val_loader = DataLoader(val_dataset, batch_size=16, shuffle=False, collate_fn=collate_fn)

    # Model initialization
    model = RCNNCTCModel(num_classes=NUM_CLASSES)

    # Train the model
    train_model(model, train_loader, val_loader, num_epochs=50, device=device)

    # Export to ONNX
    model.load_state_dict(torch.load('best_rcnn_ctc.pth'))
    model.eval()
    dummy_input = torch.randn(1, 1, IMG_HEIGHT, IMG_WIDTH, device=device)
    torch.onnx.export(
        model,
        dummy_input,
        "reader.onnx",
        input_names=['input'],
        output_names=['output'],
        dynamic_axes={'input': {0: 'batch'}, 'output': {1: 'batch'}},
        opset_version=11
    )
    print("Model exported to reader.onnx")

if __name__ == "__main__":
    main()