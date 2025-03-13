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

function to256(value, min, max) {
    return Math.round(255 * (value - min) / (max - min));
}

function to65535(value, min, max) {
    return Math.round(65535 * (value - min) / (max - min));
}

function intToTwoBytes(num) {
    if (num < 0 || num > 65535) {
      throw new Error('Input number must be between 0 and 65535');
    }
  
    const byte1 = num >> 8;  // Shift right by 8 bits to get the first byte
    const byte2 = num & 255;  // Mask the second byte using bitwise AND with 255 (0xFF)
    return [byte1, byte2];
}
 
function getPositionsAsOneByte(gsData) {
    let nSplats = gsData.getNumberOfSplats();
    let positions = new Uint8Array(nSplats * 3);
    let posBounds = gsData.getPositionBounds();
    let fBuffer = gsData.getBuffer(cGSData.POSITION);
    let cnt = 0;
    for(let i=0; i<nSplats; i++) {
        let posInd = gsData.getBufferInd(cGSData.POSITION, i);
        for(j=0; j<3; j++) {
            positions[cnt] = to256(fBuffer[posInd + j], posBounds[2*j], posBounds[2*j+1]);
            cnt++;
        }
    }

    return positions;
}

function getPostions(gsData) {

    let nSplats = gsData.getNumberOfSplats();
    let positions = new Uint8Array(nSplats * 3 * 2);
    let posBounds = gsData.getPositionBounds();
    let fBuffer = gsData.getBuffer(cGSData.POSITION);
    let cnt = 0;
    for(let i=0; i<nSplats; i++) {
        let posInd = gsData.getBufferInd(cGSData.POSITION, i);
        for(j=0; j<3; j++) {
            let pos = to65535(fBuffer[posInd + j], posBounds[2*j], posBounds[2*j+1])
            let [byte1, byte2] = intToTwoBytes(pos);
            positions[cnt] = byte1;
            positions[cnt + 1] = byte2;
            cnt += 2;
        }
    }

    return positions;
}

function getScales(gsData) {
    let nSplats = gsData.getNumberOfSplats();
    let scales = new Uint8Array(nSplats * 3);
    let scaleBounds = gsData.getScaleBounds();
    let fBuffer = gsData.getBuffer(cGSData.SCALE);
    let cnt = 0;
    for(let i=0; i<nSplats; i++) {
        let scaleInd = gsData.getBufferInd(cGSData.SCALE, i);
        for(j=0; j<3; j++) {
            scales[cnt] = to256(fBuffer[scaleInd + j], scaleBounds[2*j], scaleBounds[2*j+1]);
            cnt++;
        }
    }
    return scales;
}

function getQuaternions(gsData) {
    let nSplats = gsData.getNumberOfSplats();
    let quaternions = new Uint8Array(nSplats * 4);    
    let uBuffer = gsData.getBuffer(cGSData.QUATERNION);
    let cnt  =0;
    for(let i=0; i<nSplats; i++) {
        let quatInd = gsData.getBufferInd(cGSData.QUATERNION, i);
        for(j=0; j<4; j++) {
            quaternions[cnt] = uBuffer[quatInd + j];
            cnt++;
        }
    }
    return quaternions;
}

function getColors(gsData) {    
    let nSplats = gsData.getNumberOfSplats();
    let colors = new Uint8Array(nSplats * 4);
    let uBuffer = gsData.getBuffer(cGSData.COLOR);
    let cnt = 0;
    for(let i=0; i<nSplats; i++) {
        let colorInd = gsData.getBufferInd(cGSData.COLOR, i);
        for(j=0; j<4; j++) {
            colors[cnt] = uBuffer[colorInd + j];
            cnt++;
        }
    }
    return colors;
}

function convertTo2BytesArray(numberArray) {
    let n = numberArray.length;
    let outArray = new Uint8Array(n * 2);
    for(let i=0; i<n; i++) {
        let [byte1, byte2] = intToTwoBytes(numberArray[i]);
        outArray[2*i] = byte1;
        outArray[2*i + 1] = byte2;
    }
    return outArray;
}

async function getUniqueColors(gsData, colorTol, updateCB) {

    const MAX_INDEX_COUNT = 65535;
    const nAttempts = 3;
    let currentAttempt = 0;
    let uniqueColorsTable = null;
    do {
        uniqueColorsTable = await gsData.getUniqueColors(colorTol, MAX_INDEX_COUNT, updateCB);
        if(!uniqueColorsTable) {
            colorTol *= 1.5;
        }
        currentAttempt++;
    } while(!uniqueColorsTable && currentAttempt < nAttempts);

    if(!uniqueColorsTable) {
        return null;
    }
    
    let [splatIndToColorInd, uniqueColors] = uniqueColorsTable;

    let outSplatIndToCInd = convertTo2BytesArray(splatIndToColorInd);
    let outUniqueColors = new Uint8Array(uniqueColors.length * 4);
    let nUniqueColors = uniqueColors.length;
    for(let i=0; i<nUniqueColors; i++) {
        let colorInd = i * 4;
        for(let j=0; j<4; j++) {
            outUniqueColors[colorInd + j] = uniqueColors[i][j];
        }
    }

    return [outSplatIndToCInd, outUniqueColors];
}

/*
Desc: Converts a Gaussian splatting mesh, given a Babylon object,  to a hypGS format

Input: 
    gs: Gaussian splatting mesh
    options: An object containing the following properties:
        - updateCB: A callback function for updates (default: null)
        - returnUnitedArray: If true, the function returns a Uint8Array containing both the float and uint8 data (default: true)
        - colorTolerance: The color tolerance used to calculate the unique colors (default: 100)

Output: 
    Uint8Array containing the hypGS data if succeed, null otherwise

Example:
    let gaussianSplattingsMesh = new BABYLON.GaussianSplattingMesh("gs", plyOrSplat_url, scene);
    gaussianSplattingsMesh.onMeshReadyObservable.add(() => {
        let options = { updateCB: null, returnUnitedArray: true, colorTolerance: 100 };
        let hyp = await babylonGsToHyp(gaussianSplattingsMesh, options);
        // download hyp ...
    });     
*/

async function babylonGsToHyp(gs, {updateCB = null, returnUnitedArray = true, colorTolerance = 100}) {
    let version = 3.0 // version of the hypGS;
    
    let gsData = new cGSData(gs.splatsData);
    let posBounds = gsData.getPositionBounds();
    let scaleBounds = gsData.getScaleBounds();

    const numSplats = gsData.getNumberOfSplats();
    //console.log("numSplats: ", numSplats);

    const positions = getPostions(gsData);
    const scales = getScales(gsData);
    const quaternions = getQuaternions(gsData);

    // get unique colors
    const colorTable = await getUniqueColors(gsData, colorTolerance, updateCB);
    if(!colorTable) {
        console.error("Failed to get unique colors");
        return null;
    }
    const [splatIndToColorInd, uniqueColors] = colorTable;
    console.log("uniqueColors.length: ", uniqueColors.length)
    
    // Calculate total length
    const totalLength = positions.length + scales.length + quaternions.length + splatIndToColorInd.length + uniqueColors.length;
    
    // Create a new Uint8Array with the total length
    const uint8Data = new Uint8Array(totalLength);
           
    // Copy the arrays into the new Uint8Array
    uint8Data.set(positions, 0);
    uint8Data.set(scales,         positions.length);
    uint8Data.set(quaternions,    positions.length + scales.length);
    //uint8Data.set(colors, positions.length + scales.length + quaternions.length);
    uint8Data.set(splatIndToColorInd, positions.length + scales.length + quaternions.length);
    uint8Data.set(uniqueColors,   positions.length + scales.length + quaternions.length + splatIndToColorInd.length);

    if(uniqueColors.length % 4 != 0) {
        console.error("Invalid unique colors length: expected multiple of 4, got ", uniqueColors.length);
        return null;
    }   

    // Capture float data
    let concatenatedData = [version].concat(posBounds).concat(scaleBounds).concat([numSplats, uniqueColors.length / 4]);
    const floatData = new Float32Array(concatenatedData);

    if(returnUnitedArray) {
        // combine the float and uint8 data
        let combinedLength = floatData.length * 4 + uint8Data.length;   
        let combinedArray = new Uint8Array(combinedLength);
        let floatDataView = new DataView(floatData.buffer);
        for (let i = 0; i < floatData.length * 4; i++) {
            combinedArray[i] = floatDataView.getUint8(i);
        }
        for (let i = 0; i < uint8Data.length; i++) {
            combinedArray[floatData.length * 4 + i] = uint8Data[i];
        }
        return combinedArray;
    }
    else 
        return [floatData, uint8Data];
}


/*
Desc: Converts a Gaussian splatting mesh from a given URL to a hypGS format

Input: 
    url: URL of the Gaussian splatting mesh file
    options: An object containing the following properties:
        - updateCB: A callback function for updates
        - returnUnitedArray: If true, the function returns a Uint8Array containing both the float and uint8 data
        - colorTolerance: The color tolerance used to calculate the unique colors
        - downloadFile: If true, the function will trigger a download of the converted hyp file

Output: 
    A promise that resolves to the hypGS data if successful, null otherwise

Example:
    let options = { updateCB: null, returnUnitedArray: true, colorTolerance: 100, downloadFile: true };
    let hyp = await genericGsToHyp('sample_data/clown.splat', options);
*/

async function genericGsToHyp(url, {updateCB, returnUnitedArray, colorTolerance, downloadFile}) {
    
    engine = await initializeBabylonEngine();
    //scene = createScene(engine);
    scene = new BABYLON.Scene(engine);
    // BabylonJS requires to have a camera    
    var camera = new BABYLON.ArcRotateCamera("camera1", -Math.PI / 2, Math.PI / 2, 3, new BABYLON.Vector3(0, 0, 0), scene);
    // This attaches the camera to the canvas
    camera.attachControl(canvas, true);

    return new Promise((resolve, reject) => {
        let gaussianSplattingsMesh = new BABYLON.GaussianSplattingMesh("gs", url, scene, true);
        gaussianSplattingsMesh.onMeshReadyObservable.add(async () => {
            try {
                console.log('Mesh ready!');

                let options = {updateCB: updateCB, returnUnitedArray: returnUnitedArray, colorTolerance: colorTolerance};
                const hypData = await babylonGsToHyp(gaussianSplattingsMesh, options);
                console.log('Conversion finished!');

                gaussianSplattingsMesh.dispose();
                scene.dispose();
                engine.dispose();
                canvas.remove();

                if(downloadFile) {
                    // download the converted data
                    const hypDataBlob = new Blob([hypData], {type: 'application/octet-stream'});
                    const hypDataUrl = URL.createObjectURL(hypDataBlob);
                    const hypDataLink = document.createElement('a');
                    hypDataLink.href = hypDataUrl;

                    // extract the filename from the url
                    let filename = url.split('/').pop();
                    hypDataLink.download = filename.replace(/\.[^/.]+$/, "") + '.hyp';

                    hypDataLink.click();
                }

                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });
}

/*
Desc: Converts a PLY file to a hypGS format

Input: 
    url: URL of the PLY file
    options: An object containing the following properties:
        - downloadFile: If true, the function will trigger a download of the converted hyp file
        - updateCB: A callback function for updates (default: null)
        - returnUnitedArray: If true, the function returns a Uint8Array containing both the float and uint8 data (default: true)
        - colorTolerance: The color tolerance used to calculate the unique colors (default: 100)

Output: 
    A promise that resolves to the hypGS data if successful, null otherwise

Example:
    let options = { downloadFile: true, updateCB: null, returnUnitedArray: true, colorTolerance: 100 };
    let hyp = await plyToHyp('sample_data/clown.ply', options);
*/

async function plyToHyp(url, {downloadFile, updateCB = null, returnUnitedArray = true, colorTolerance = 100}) {
    
    // check if the url ends with .ply
    if(!url.endsWith('.ply')) {
        console.error("Invalid file extension. Expected .ply, got ", url);
        return null;
    }

    let options = {updateCB: updateCB, returnUnitedArray: returnUnitedArray, colorTolerance: colorTolerance, downloadFile: downloadFile};
    return genericGsToHyp(url, options);
}

/*
Desc: Converts a SPLAT file to a hypGS format

Input: 
    url: URL of the SPLAT file
    options: An object containing the following properties:
        - downloadFile: If true, the function will trigger a download of the converted hyp file
        - updateCB: A callback function for updates (default: null)
        - returnUnitedArray: If true, the function returns a Uint8Array containing both the float and uint8 data (default: true)
        - colorTolerance: The color tolerance used to calculate the unique colors (default: 100)

Output: 
    A promise that resolves to the hypGS data if successful, null otherwise

Example:
    let options = { downloadFile: true, updateCB: null, returnUnitedArray: true, colorTolerance: 100 };
    let hyp = await splatToHyp('sample_data/clown.splat', options);
*/

async function splatToHyp(url, {downloadFile, updateCB = null, returnUnitedArray = true, colorTolerance = 100}) {
    // check if the url ends with .splat
    if(!url.endsWith('.splat')) {
        console.error("Invalid file extension. Expected .splat, got ", url);
        return null;
    }

    let options = {updateCB: updateCB, returnUnitedArray: returnUnitedArray, colorTolerance: colorTolerance, downloadFile: downloadFile};
    return genericGsToHyp(url, options);
}
