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

var createScene = function () {

    var hypData = null;
    var gaussianSplattingsMesh = null;
    var gaussianSplattingsFile = null;

    // create a basic BJS Scene object
    var scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color3(1.0, 1.0, 1.0);   

    // create camera
    let radius = 3;
    var camera = new BABYLON.ArcRotateCamera("camera1", -Math.PI / 2, Math.PI / 2, radius,new BABYLON.Vector3(0, 0, 0), scene);
    // This attaches the camera to the canvas
    camera.attachControl(canvas, true);
    camera.fov = 0.6;

    let [instructions, convertBt, downloadBt, progressBar, progressBarInner]  = createUI();

    // setup drag and drop
    let filesInput = new BABYLON.FilesInput(engine, null, scene, null, null, null, function () { BABYLON.Tools.ClearLogCache() }, null, null);
    filesInput.onProcessFileCallback = (file, name, extension) => {dragAndDropCB(file, name, extension); };
    filesInput.monitorElementForDragNDrop(canvas);

    function dragAndDropCB(file, name, extension) {
        if(extension !== "splat" && extension !== "ply" && extension !== "hyp") {
            alert("Only .splat, .ply, and .hyp files are supported");
            return;
        }
    
        // remove the extention from the filename
        gaussianSplattingsFile = name.replace(/\.[^/.]+$/, "");

        if(gaussianSplattingsMesh) {
            gaussianSplattingsMesh.dispose();        
        }
        
        const blob = new Blob([file]);
        let url = URL.createObjectURL(blob); 
        if(extension === "hyp") {
            const fileReader = new FileReader();
            fileReader.onload = function() {
                const arrayBuffer = this.result;
                const hypData = new Uint8Array(arrayBuffer);
                
                let newGS = fromHyp(hypData, scene)
                if(gaussianSplattingsMesh)
                    gaussianSplattingsMesh.dispose();
                gaussianSplattingsMesh = newGS;         
                instructions.isVisible = false;         
            };
            fileReader.readAsArrayBuffer(blob);
        }
        else {
            gaussianSplattingsMesh = new BABYLON.GaussianSplattingMesh("gs", url, scene, true);
    
            gaussianSplattingsMesh.onMeshReadyObservable.add(() => {
                instructions.isVisible = false;
                convertBt.isVisible = true;
                downloadBt.isVisible = false;
            });     
        }
    }

    // setup callbacks for the buttons

    convertBt.onPointerDownObservable.add(function() {
        convertBt.isVisible = false;

        progressBarInner.isVisible = true;
        progressBar.isVisible = true;
        updateProgressBar(0.0);
        
        // convert Gaussian Splatting to hyp
        babylonGsToHyp(gaussianSplattingsMesh, { updateCB: updateProgressBar}).then(
            (hyp) => {

                // hide the progress bar
                progressBarInner.isVisible = false;
                progressBar.isVisible = false;
                        
                hypData = hyp;
                if(hypData){
                    downloadBt.isVisible = true;

                    let newGS = fromHyp(hypData, scene)
                    gaussianSplattingsMesh.dispose();
                    gaussianSplattingsMesh = newGS;
                }
                else {
                    alert("Failed to convert to hyp");
                    
                    gaussianSplattingsMesh.dispose();
                    gaussianSplattingsMesh = null;

                    instructions.isVisible = true;
                }
            }
        );
    });

    downloadBt.onPointerDownObservable.add(function() {
        downloadHyp(hypData, gaussianSplattingsFile + ".hyp");
    }  );

    function updateProgressBar(progress) {
        progressBarInner.width = progress;
    }

    return scene;
};



function createUI() {
    var advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

    var text1 = new BABYLON.GUI.TextBlock();
    text1.text = "Drag and drop\nGaussian Splattings to start";
    text1.color = "black";
    text1.fontSize = 40;
    advancedTexture.addControl(text1);   
    
    var convertBt = BABYLON.GUI.Button.CreateSimpleButton("convert", "Convert");
    convertBt.width = 0.2;
    convertBt.height = 0.2;
    convertBt.color = "white";
    convertBt.background = "black";
    // make the button's corner round
    convertBt.cornerRadius = 20;
    convertBt.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    convertBt.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    convertBt.isVisible = false;
    advancedTexture.addControl(convertBt);

    var downloadBt = BABYLON.GUI.Button.CreateSimpleButton("download", "Download");
    downloadBt.width = 0.2;
    downloadBt.height = 0.2;
    downloadBt.color = "white";
    downloadBt.background = "green";
    downloadBt.cornerRadius = 20;
    downloadBt.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    downloadBt.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    downloadBt.isVisible = false;
    advancedTexture.addControl(downloadBt);

    var progressBar = new BABYLON.GUI.Rectangle();
    progressBar.height = 0.1;
    progressBar.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    progressBar.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    progressBar.background = "black";
    progressBar.isVisible = false;
    advancedTexture.addControl( progressBar );

    var progressBarInner = new BABYLON.GUI.Rectangle();
    progressBarInner.width = 0;
    progressBarInner.height = 0.1; 
    progressBarInner.thickness = 0;
    progressBarInner.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    progressBarInner.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    progressBarInner.background = "green";
    progressBarInner.isVisible = false;
    advancedTexture.addControl( progressBarInner );
    
    return [text1, convertBt, downloadBt, progressBar, progressBarInner];
}

function downloadHyp(hyp, filename) {
    const blob = new Blob([hyp.buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
  
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);    
}

