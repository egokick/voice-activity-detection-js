import * as ort from 'onnxruntime-web';
// Rest of your code

  
// Function to load the ONNX model
async function loadModel() {
    const session = await ort.InferenceSession.create('silero_vad.onnx');
    return session;
}

// Function to process audio data
async function processAudioData(audioData, session) {
    // The model expects 'sr_input' as int64, so we create an Int64Array
    // Since JavaScript does not support Int64Array, we need to use Float64Array
    // or manually create the tensor with type 'int64'.
    const sr_input = new BigInt64Array([16000n]);

    const num_layers = 1;
    const num_directions = 2; // Adjust if needed
    const hidden_size = 64; // Confirm the actual hidden size
    const batch_size = 1;

    // Convert audio data to a tensor
    const inputTensor = new ort.Tensor('float32', audioData, [batch_size, audioData.length]);

    // Initialize 'h' and 'c' as tensors with the correct dimensions
    const h_tensor = new ort.Tensor('float32', new Float32Array(num_layers * num_directions * batch_size * hidden_size).fill(0), [num_layers * num_directions, batch_size, hidden_size]);
    const c_tensor = new ort.Tensor('float32', new Float32Array(num_layers * num_directions * batch_size * hidden_size).fill(0), [num_layers * num_directions, batch_size, hidden_size]);
    
    // Create the 'sr' tensor with type 'int64' manually
    const sr_tensor = new ort.Tensor('int64', sr_input, [1]);

    // Run the model
    const outputs = await session.run({
        input: inputTensor, // The input tensor
        sr: sr_tensor,     // Sample rate tensor
        h: h_tensor,       // h state tensor
        c: c_tensor        // c state tensor
    });

    return outputs;
}


async function main() {
    const session = await loadModel();
    const canvas = document.getElementById('audioCanvas');
    const ctx = canvas.getContext('2d');

    // Buffers to store audio values
    const audioBuffer = new Array(canvas.width).fill(0);
    const volumeBuffer = new Array(canvas.width).fill(0);

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);

            source.connect(processor);
            processor.connect(audioContext.destination);

            processor.onaudioprocess = async function(e) {
                const audioData = e.inputBuffer.getChannelData(0);
                const outputs = await processAudioData(audioData, session);
                const value = outputs.output.data[0];

                // Update the audio data buffer
                audioBuffer.push(value);
                audioBuffer.shift();

                // Calculate and update the volume buffer
                const volume = calculateRMS(audioData);
                volumeBuffer.push(volume);
                volumeBuffer.shift();

                // Draw both graphs
                drawGraph(ctx, audioBuffer, canvas.width, canvas.height / 2, 0);
                drawGraph(ctx, volumeBuffer, canvas.width, canvas.height / 2, canvas.height / 2);
            };
        })
        .catch(err => {
            console.error('Error accessing media devices.', err);
        });
}

function calculateRMS(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
}

function drawGraph(ctx, buffer, width, height, yOffset) {
    // Clear the canvas area for this graph
    ctx.clearRect(0, yOffset, width, height);

    // Begin the line path
    ctx.beginPath();
    for (let i = 0; i < buffer.length; i++) {
        const x = i;
        const y = (1 - buffer[i]) * height + yOffset;

        // Move to the next point
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }

    // Draw the line
    ctx.strokeStyle = '#00ff00'; // Different color for volume
    ctx.lineWidth = 2;
    ctx.stroke();
}

main();
