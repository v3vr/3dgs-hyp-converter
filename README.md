# hyp

`.hyp` is a file format for compressed 3D gaussian splats

It is specifically designed for object representation (as opposed to enviroments). It provides a 2x size reduction compared to the `.splat` format and up to 15x reduction to the`.ply` format. `.hyp` is an ideal format for web including in-browser apps with limited resources. This format features variable levels of compression for colors, providing versatility for a wide range of applications.

## Demo
To try a simple demo, [click here](https://hyperinteractive.ai/hyp/) Drag and drop a `.splat` or `.ply` file. You can explore Gaussian Splatting by dragging to rotate and translate the view, and using the scroll wheel to zoom. Click the convert button to produce into `.hyp` file, and then use the download button to download it. 

Note: you can also drag and drop `.hyp` files to view their Gaussian Splatting data.

To recreate the demo, clone the folder structure, load it to Visual Studio Code, and open `demo/index.html` with Live Server.

## File Format overview

File size reduction is achieved through data representation for positions, scales, and color components of Gaussian splats

### Positions:
HYP file format is intended for objects (as opposed to environments). With this in mind, we use scaled two-bytes representation of x, y, z components. Two bytes allow to represent 65536 distinctive numbers, which translates to 0-65535 range of integer numbers. To take the full advantage of the range, we use Gaussian Splattings' bounding box values to scale the range's values. Thus, mapping a position from hyp representation to conventional one becomes
`p.x = min.x + (hyp.x / 65535) * (max.x - min.x);`
`p.y = min.y + (hyp.y / 65535) * (max.y - min.y);`
`p.z = min.z + (hyp.z / 65535) * (max.z - min.z);`
where `hyp` is hyp 3DGS representation of position,
`min` and `max` are bounding box coordinates
`p` is the resulting position of 3DGS

splat file format uses 4 bytes per each location component (x,y,z). Thus to store N splats, splat file format requires 4 * N bytes per component while hyp requires only 2 * N  + 2 * 4 bytes. (2*4 bytes are to store floats for min and max values)

### Scales:
We apply a similar approach to scales. However, we observe that range of scales is much smaller that range of positions. Consequently we can use one-byte representation for scales. Consequently, mapping a scale from hyp representation to conventional one becomes
`s.x = min.x + (hyp.x / 255) * (max.x - min.x);`
`s.y = min.y + (hyp.y / 255) * (max.y - min.y);`
`s.z = min.z + (hyp.z / 255) * (max.z - min.z);`
where `hyp` is hyp 3DGS representation of scale,
`min` and `max` are bounding values of scale
`s` is the resulting scale of 3DGS

splat file format uses 4 bytes per each scale component (x,y,z). Thus to store N splats, splat file format requires 4 * N bytes per component. In contrast hyp scales need only N  + 2 * 4 bytes. (2*4 bytes are to store floats for min and max values)

### Quaternion: 
we use the same representation as splat file format, which is one byte per component

### Color:
HYP offer variable levels of compression for colors. Storing colors, we take advantage of similar colors present throughout volume of 3DGS object. To this end, we introduce a table of representative colors and define Gaussian splats' colors by indices to the table. By controlling number of entries of the table (i.e. the table size), we provide our users with flexibility to specify a desired level of color compression. However, since we use two bytes to record table indices, number of entries cannot be greater than 65535. 

splat file format uses 4 bytes per RGBA color. Thus N Gaussian splats would require N * 4 bytes of storage for color. HYP would require N * 2  + table size. N * 2 terms is memory space needed to store indices to the table. The table size varies depending on the demanded precision. In practice, we found the best balance between quality and memory size achieved when each RGBA color of the table are used on average by 8 splats. In this case, the size of the table would be N/8 * 4 bytes (N/8 is number of entries and 4 is byte size of each entry). That leads to N * 2 + N / 8 * 4 = 2.5 * N bytes.

## Limitations
* outputs spherical harmonics of order 0.
* works best with objects rather than environments (due to the limiation size of the bouding volume).

## Implementation 
* dependency on `BabylonJS`
* written in javascript and optimized for use in browser 

### Folder Structure
* `demo` - sample 
* `src` - javascripts to be included

## API

* splatToHyp(url, {downloadFile, updateCB = null, returnUnitedArray = true, colorTolerance = 100}) 
* plyToHyp(url, {downloadFile, updateCB = null, returnUnitedArray = true, colorTolerance = 100})
    async functions to convert a splat file or a ply file to a hypGS format

    Input: 
    - `url`: URL of splat or ply file
    - options: An object containing the following properties:
        - `downloadFile`: If true, the function will trigger a download of the converted hyp file
        - `updateCB`: A callback function for updates (default: null)
        - `returnUnitedArray` - boolean flag to indicate whether return results  as single 
                    `Uint8Array`  array  or as two arrays logically separated onto 
                    float and integer arrays (`Float32Array` and `Uint8Array`)
        - `colorTolerance` - parameter to be define uniquie colors. It represents squared distance 
                    in color place to indicate colors that should be considered the same 
                    (and be approximated with average). The color space is defined using 
                    [0,255] for each color component. In case of `colorTolerance` is too 
                    low and creates a number of color samples that cannot be saved in two
                    bytes, the function attempts to adjust `colorTolerance` 

    Output: 
    - A promise that resolves to the hypGS data if successful, null otherwise

    Example:
    `let options = { downloadFile: true, updateCB: null, returnUnitedArray: true, colorTolerance: 100 };`
    `let hyp = await plyToHyp('sample_data/clown.ply', options);`


*  babylonGsToHyp(gs, {updateCB = null, returnUnitedArray = true, colorTolerance = 100})
    async function to convert BabylonJS Gaussian Splatting data to hyp format. In case of error, returns null.

    Input: 
    - `gs` - BabylonJS Gaussian Splatting mesh
    - options: An object containing the following properties:
        - `updateCB`: A callback function for updates (default: null)
        - `returnUnitedArray` - boolean flag to indicate whether return results  as single 
                    `Uint8Array`  array  or as two arrays logically separated onto 
                    float and integer arrays (`Float32Array` and `Uint8Array`)
        - `colorTolerance` - parameter to be define uniquie colors. It represents squared distance 
                    in color place to indicate colors that should be considered the same 
                    (and be approximated with average). The color space is defined using 
                    [0,255] for each color component. In case of `colorTolerance` is too 
                    low and creates a number of color samples that cannot be saved in two
                    bytes, the function attempts to adjust `colorTolerance` 

    Output: 
    - A promise that resolves to the hypGS data if successful, null otherwise

    Example:
    `let gaussianSplattingsMesh = new BABYLON.GaussianSplattingMesh("gs", plyOrSplat_url, scene);`
    `gaussianSplattingsMesh.onMeshReadyObservable.add(() => {`
        `let hyp = toHyp(gaussianSplattingsMesh);`
        `// download hyp ...`
    `});`     

* function fromHyp(hypData, scene) 
    converts Gaussian Splatting from hyp data format to BabylonJS GaussianSplattingMesh. In case of error, returns null.
    
    Input
    - `hypData` - gaussian splatting data, given in hyp data format
    - `scene` - BabylonJS scene

    Output:
    - BabylonJS GaussianSplattingMesh if the function is successful. Otherwise returns null.

    Example:
    `const hypData = new Uint8Array(hypFileContent);`
    `let gaussianSplattingsMesh = fromHyp(hypData, scene)`


## Includes

Consider `demo\index.html` as an include example

### BabylonJS Includes
* `babylon.js`
* `serializers/babylonjs.serializers.min.js`

### HYP Includes
* `src/fromHyp.js`
* `src/gsData.js`
* `src/toHyp.js`


## File Format

### Overview


### File Format Structure
Conceptually hyp data is a float array, concatenated with an unsigned integer array

#### Float Array (`Float32Array`)
data appears in the following order
* version
* position bounds (`minX`, `maxX`, `minY`, `maxY`, `mimZ`, `maxZ`)
* scale bounds (`minX`, `maxX`, `minY`, `maxY`, `mimZ`, `maxZ`)
* number of unique colors


#### Unsigned Integer Array (`Uint8Array`)
data appears in the following order
* positions - (`x`, `y`, `z`) coordinates. Each component is saved 16-bit fixed point unsigned integer that should be scaled by positions' bounds 
* scales  - (`x`, `y`, `z`) coordinates. Each component is saved 8-bit fixed point unsigned integer that should be scaled by scales' bounds 
* quaternions - (`x`, `y`, `z`) components. Each component is saved 8-bit fixed point unsigned integer
* color indices. Each index is saved 16-bit fixed point unsigned integer that serves as a index to the color array (i.e. color table)
* color array - (`r`, `g`, `b`, `a`) components. Each component is saved 8-bit fixed point unsigned integer

