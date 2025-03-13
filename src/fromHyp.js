/*
Copyright (c) 2025 Very 360 VR. DBA Hyper Interactive

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

function twoBytesToInt(byte1, byte2) {
    if (byte1 < 0 || byte1 > 255 || byte2 < 0 || byte2 > 255) {
      throw new Error('Input bytes must be between 0 and 255');
    }
  
    const combined = byte1 << 8 | byte2;  // Shift the first byte left by 8 bits and combine with the second byte
    return combined;
}

function extractArrays(combinedArray) {

    // print length
    console.log("combinedArray.length: ", combinedArray.length);
    
    // read the version
    const floatSize = Float32Array.BYTES_PER_ELEMENT;
    let tmpBuffer  = new Float32Array(combinedArray.slice(0, floatSize).buffer);
    const version = Math.round(tmpBuffer[0]);

    const numFloats = version === 1 ?  14 : // version (1), position bounds (2*3), scale bounds (2*3), num splats (1)
                      version === 2 ?  16 : // version (1), position bounds (2*3), scale bounds (2*3), num splats (1), num rotated scales (1), num unique colors (1)
                      version === 3 ?  15 : // version (1), position bounds (2*3), scale bounds (2*3), num splats (1), num unique colors (1)
                        0;

    if(numFloats === 0) {
        console.error("Invalid version: ", version);
        return null;
    }

    const floatArraySize = numFloats * floatSize;
    //console.log("floatArraySize: ", floatArraySize, numFloats, " x ", floatSize);

    // Extract the float data
    const floatBuffer = combinedArray.slice(0, floatArraySize).buffer;
    const floatView = new Float32Array(floatBuffer);

    // Extract the uint8 data
    const uintBuffer = combinedArray.slice(floatArraySize).buffer;
    const uintView = new Uint8Array(uintBuffer);

    //console.log("floatView: ", floatView[0], floatView[1], floatView[2], floatView[3]);
    //console.log("uintView: ", uintView[0], uintView[1], uintView[2], uintView[3]);
    //console.log("combinedArray at ", floatArraySize, " is ", combinedArray[floatArraySize], combinedArray[floatArraySize +1]);
    return [floatView, uintView ];

}

/* 
* Desc: Converts Gaussian Splatting from hyp data format to GaussianSplattingMesh
*
* Input: hypData: Uint8Array
*        scene: BABYLON.Scene
*
* Output: GaussianSplattingMesh if succeed, null otherwise
*
* Example:
*     let fileReader = new FileReader();
*     fileReader.onload = function() {
*         const arrayBuffer = this.result;
*         const hypData = new Uint8Array(arrayBuffer);  
*         let newGS = fromHyp(hypData, scene)
*         if(gaussianSplattingsMesh)
*             gaussianSplattingsMesh.dispose();
*         gaussianSplattingsMesh = newGS;   
*     };
*     fileReader.readAsArrayBuffer(blob);
*/
function fromHyp(hypData, scene) {

    let [floatData, uint8Data] = extractArrays(hypData);
    
    // check if length is correct
    if(floatData.length != 15) {
        console.error("Invalid float data size: expected 15, got ", floatData.length);
        return null;
    }
    //let version = this.getVersion(floatData[0]);

    let posBounds = floatData.slice(1, 7);
    let scaleBounds = floatData.slice(7, 13);
    let nSplats = floatData[13];
    let nUniqueColors = floatData[14];

    // each row contains pos (2*3 byte), scale (3 byte), quaternion (4 byte), color ind (1 byte)
    const hypRowLength = 2*3 + 3 + 4 + 1;
    const colDataRowLength = 4;
    const posOffset = 0;
    const scaleOffset = 2 * 3 * nSplats + posOffset;
    const quatOffset = 3 * nSplats + scaleOffset;
    const colIndOffset = 4 * nSplats + quatOffset;
    const colDataOffset = 2 * nSplats + colIndOffset;

    if(colDataOffset + colDataRowLength * nUniqueColors != uint8Data.length) {
        console.error("Invalid data size for ", nSplats, " splats: expected ", nSplats * 17 + 2, " got ", uint8Data.length);
        return null;
    }

    // allocate GS buffers
    const uBuffer = new Uint8Array(nSplats * cGSData.ROW_LENGTH_IN_BITES);
    const fBuffer = new Float32Array(uBuffer.buffer);
        
    let gsData = new cGSData(uBuffer);
    for(let i=0; i<nSplats; i++) {

        let posInd = gsData.getBufferInd(cGSData.POSITION, i);
        let scaleInd = gsData.getBufferInd(cGSData.SCALE, i);
        let quatInd = gsData.getBufferInd(cGSData.QUATERNION, i);
        let colorInd = gsData.getBufferInd(cGSData.COLOR, i);

        for(let j=0; j<3; j++) {
            
            //fBuffer[posInd + j] = posBounds[2*j] + (uint8Data[posOffset + i * 3 + j] / 255) * (posBounds[2*j+1] - posBounds[2*j]);
            let value = twoBytesToInt(uint8Data[posOffset + i * 6 + 2*j], uint8Data[posOffset + i * 6 + 2*j + 1]);
            fBuffer[posInd + j] = posBounds[2*j] + (value / 65535) * (posBounds[2*j+1] - posBounds[2*j]);

            fBuffer[scaleInd + j] = scaleBounds[2*j] + (uint8Data[scaleOffset + i * 3 + j] / 255) * (scaleBounds[2*j+1] - scaleBounds[2*j]);
        }

            for(let j=0; j<4; j++) {
                uBuffer[quatInd + j] = uint8Data[quatOffset + i * 4 + j];
        }
    
        // record the colors
        let uniqueColorInd = twoBytesToInt(uint8Data[colIndOffset + i*2], uint8Data[colIndOffset + i*2 + 1]);
        for(let j=0; j<4; j++) {
            uBuffer[colorInd + j] = uint8Data[colDataOffset + uniqueColorInd * 4 + j];
        }
    }

    let gsMesh = new BABYLON.GaussianSplattingMesh("gs", undefined, scene, true);
    gsMesh.updateData(uBuffer);
    return gsMesh;
}
