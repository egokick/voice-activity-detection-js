import * as ort from 'onnxruntime-web';
  
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

// Function to detect speech timestamps in collected audio data
async function detectSpeechTimestamps(collectedAudioData, session, threshold = 0.1, windowSizeSamples = 256) {
    let speechProbs = [];
    for (let i = 0; i < collectedAudioData.length; i += windowSizeSamples) {
        const chunk = collectedAudioData.slice(i, Math.min(i + windowSizeSamples, collectedAudioData.length));
        // Ensure the chunk is the correct size
        if (chunk.length < windowSizeSamples) {
            const paddedChunk = new Float32Array(windowSizeSamples);
            paddedChunk.set(chunk);
            chunk = paddedChunk;
        }
        const outputs = await processAudioData(chunk, session);
        const speechProb = outputs.output.data[0];
        speechProbs.push(speechProb);
    }

    // Analyze speech probabilities to determine speech timestamps
    let speeches = [];
    let isSpeech = false;
    let speechStart = 0;
    for (let i = 0; i < speechProbs.length; i++) {
        if (speechProbs[i] > threshold && !isSpeech) {
            isSpeech = true;
            speechStart = i * windowSizeSamples;
        } else if (speechProbs[i] <= threshold && isSpeech) {
            isSpeech = false;
            speeches.push({ start: speechStart, end: i * windowSizeSamples });
        }
    }
    if (isSpeech) {
        speeches.push({ start: speechStart, end: collectedAudioData.length });
    }

    if (speeches.length > 0) {
        console.log("Speech detected");
    } else {
        console.log("No speech");
    }

    return speeches;
}

 

async function startAudioProcessing() {
    const session = await loadModel();
    let audioDataBuffer = [];
    const audioContext = new AudioContext();
    const sampleRate = audioContext.sampleRate;
    const bufferLength = sampleRate * 1; // 1 second buffer

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);

            source.connect(processor);
            processor.connect(audioContext.destination);

            processor.onaudioprocess = async function(e) {
                const audioData = e.inputBuffer.getChannelData(0);
                audioDataBuffer = audioDataBuffer.concat(Array.from(audioData));

                if (audioDataBuffer.length >= bufferLength) {
                    await detectSpeechTimestamps(audioDataBuffer, session);
                    audioDataBuffer = []; // Reset the buffer
                }
            };
        })
        .catch(err => {
            console.error('Error accessing media devices.', err);
        });
}


document.getElementById('startButton').addEventListener('click', () => {
    startAudioProcessing();
}); 
