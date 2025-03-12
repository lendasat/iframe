# Start from the official Rust image
FROM rust:1.85

# Install clang and other necessary packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    clang \
    libssl-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install wasm-pack
RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Create a new directory for your project
WORKDIR /usr/src/myapp

# Copy your Rust project into the container
COPY . .

# Ensure wasm-pack and other necessary tools are installed
RUN rustup target add wasm32-unknown-unknown

# Build for web using wasm-pack
CMD ["wasm-pack", "build", "--target", "web"]
