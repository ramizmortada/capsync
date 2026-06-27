import os
import wave
import numpy as np
import openvino as ov
import soundfile as sf
import subprocess
import tempfile

MODEL_PATH = r"D:\Program Files\Audacity\openvino-models\noise-suppression-denseunet-ll-0001.xml"

def enhance_audio(input_file: str, output_file: str):
    """
    Extracts audio from input_file, applies OpenVINO noise suppression,
    and saves the cleaned audio to output_file as a WAV file.
    """
    core = ov.Core()
    
    # Check if model exists
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"OpenVINO model not found at {MODEL_PATH}")

    model = core.read_model(MODEL_PATH)
    compiled_model = core.compile_model(model, "CPU")
    
    # Extract audio to 16kHz mono WAV using ffmpeg
    fd, temp_wav = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    
    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", input_file, 
            "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", 
            temp_wav
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Read the audio
        data, samplerate = sf.read(temp_wav, dtype='float32')
        if samplerate != 16000:
            raise ValueError(f"Expected 16kHz, got {samplerate}Hz")
            
        # Pad data to multiple of 128
        patch_size = 128
        padding = patch_size - (len(data) % patch_size)
        if padding != patch_size:
            data = np.pad(data, (0, padding), mode='constant')
            
        # Prepare inputs
        infer_request = compiled_model.create_infer_request()
        
        # Initialize state tensors
        for input_node in compiled_model.inputs:
            if input_node.any_name.startswith("inp_state_"):
                shape = input_node.shape
                infer_request.set_tensor(input_node, ov.Tensor(np.zeros(shape, dtype=np.float32)))
                
        out_data = []
        
        # Run inference in chunks
        # We need to map the output states back to the input states
        input_state_nodes = {n.any_name: n for n in compiled_model.inputs if n.any_name.startswith("inp_state_")}
        output_state_nodes = {n.any_name: n for n in compiled_model.outputs if n.any_name.startswith("out_state_")}
        
        # Match output state to input state based on the number
        state_mapping = {}
        for out_name, out_node in output_state_nodes.items():
            state_idx = out_name.replace("out_state_", "")
            inp_name = f"inp_state_{state_idx}"
            if inp_name in input_state_nodes:
                state_mapping[out_node] = input_state_nodes[inp_name]
        
        main_input_node = next(n for n in compiled_model.inputs if not n.any_name.startswith("inp_state_"))
        main_output_node = next(n for n in compiled_model.outputs if not n.any_name.startswith("out_state_"))
        
        for i in range(0, len(data), patch_size):
            chunk = data[i:i+patch_size].reshape(1, patch_size)
            infer_request.set_tensor(main_input_node, ov.Tensor(chunk))
            
            infer_request.infer()
            
            res = infer_request.get_tensor(main_output_node).data
            out_data.append(res.flatten())
            
            # Update states
            for out_node, inp_node in state_mapping.items():
                state_tensor = infer_request.get_tensor(out_node)
                infer_request.set_tensor(inp_node, ov.Tensor(state_tensor.data))
                
        enhanced_data = np.concatenate(out_data)
        
        # Save output
        sf.write(output_file, enhanced_data, samplerate)
        
    finally:
        if os.path.exists(temp_wav):
            os.remove(temp_wav)

if __name__ == "__main__":
    import sys
    if len(sys.argv) == 3:
        enhance_audio(sys.argv[1], sys.argv[2])
        print("Done!")
