/* Catch all function to centralize the task of fetching DOM node references */
function $(id, forceQSA) {
	if(id.substr(0, 1) == '.' || id.substr(0, 1) == '#' || id.indexOf(' ') > -1 || forceQSA) return document.querySelectorAll(id);
	else return document.getElementById(id);
}

var
	// To initiate the prallel processing worker that will do the heavy lifting
	worker = new Worker('./js/worker.js'),

	// To store the contexts of each canvas
	context = false,

	// The state of the menu panel
	menu = true,

	// The index of each color in the pixel data value arrays
	colorIndex = {red: 0, green: 1, blue: 2},

	// The RGB color threshold values given by the user, these are the defaults
	color = {red: 100, green: 100, blue: 140},

	// To store the time it took to execute a counting
	time;

// When the page has loaded all of it's DOM
window.addEventListener('DOMContentLoaded', function() {

	// If the worker sends a message to the front end process
	worker.addEventListener('message', function(e) {
		var data = e.data;

		// If the message was a progress message then worker is sending a progress update
		if(data.progress) {
			$('result:progress').value = data.done;

			// Go through each of the given result set and count the number of patches that are more than the user provided minimum pixels a patch should have
			for(var i = 0, number = 0, minimum = $('minimum').value; i < data.found.length; i++) {

				// If the patch was atleast as big as the user wanted then count it otherwise ignore it
				if(data.found[i] >= minimum)
					number++;
			}
			$('result:number').textContent = number;

		// Otherwise the worker has finished the task
		} else {
			$('result:progress').max = $('result:progress').value = 0;
			$('result:progress').style.display = 'none';

			// Go through each of the given result set and count the number of patches that are more than the user provided minimum pixels a patch should have
			for(var i = 0, number = 0, minimum = $('minimum').value; i < data.number.length; i++) {

				// If the patch was atleast as big as the user wanted then count it otherwise ignore it
				if(data.number[i] >= minimum)
					number++;
			}

			console.log(data.number);

			// So the number of patches that were counted along with how look it took to count them
			$('result:number').textContent = number + ' (' + (new Date() - time) + ' ms)';

			// Show the status in case there was an error
			$('status').innerHTML = data.status;
		}
	});

	// Start the worker process
	worker.postMessage(false);

	$('input').addEventListener('change', function(evt) {

		// When the user file input changes read the file in a FileReader as a DataURL and load the url to canvas
		var reader = new FileReader();
		reader.onload = function() {canvas.paint.image(this.result);};
		reader.readAsDataURL(evt.target.files[0]);
	});

	$('test').addEventListener('change', function() {
		if($('test').value !== 'Select One...')
			canvas.paint.image('./images/'+$('test').value+'.jpg');
	});

	// When user clicks the compact button hide the panel
	$('compact').addEventListener('click', function() {
		if(!menu) {
			$('panel').setAttribute('style', 'transform: translatex(0px)');
			$('index').setAttribute('style', 'transform: translatex(-251px)');
			$('compact').innerHTML = '&raquo;';
			menu = true;
		} else {
			$('panel').setAttribute('style', 'transform: translatex(251px)');
			$('index').setAttribute('style', 'transform: translatex(0px)');
			$('compact').innerHTML = '&laquo;';
			menu = false;
		}
	});

	// Run the counting logic
	$('rerun').addEventListener('click', canvas.assess);

	$('menu:color:red').addEventListener('mouseup', function() {
		color.red = this.value;
		canvas.update(['red']);
	});
	$('menu:color:red').addEventListener('change', function() {
		$(this.id+':counter').textContent = '('+this.value+')';
	});
	$('menu:color:green').addEventListener('mouseup', function() {
		color.green = this.value;
		canvas.update(['green']);
	});
	$('menu:color:green').addEventListener('change', function() {
		$(this.id+':counter').textContent = '('+this.value+')';
	});
	$('menu:color:blue').addEventListener('mouseup', function() {
		color.blue = this.value;
		canvas.update(['blue']);
	});
	$('menu:color:blue').addEventListener('change', function() {
		$(this.id+':counter').textContent = '('+this.value+')';
	});

	// If the user clicks on the invert button
	$('menu:invert').addEventListener('click', canvas.invert);
});

var canvas = {
	paint: {

		/*
			Inputs: file - The url of the image that needs to be processed

			This function loads the image at the given url into the orignal
			image canvas and starts the processing of the image.
		*/
		image: function(file) {
			var img = new Image();
			img.onload = function() {
				$('status').innerHTML = 'Working&hellip;';

				// Store the 2d contexts of each of the canvases along with a get/set function pair to get/set pixel data value sets
				context = {
					orignal: $('canvas:orignal').getContext('2d'),
					noiseReduction: $('canvas:noiseReduction').getContext('2d'),
					color: {
						red: $('canvas:color:red').getContext('2d'),
						green: $('canvas:color:green').getContext('2d'),
						blue: $('canvas:color:blue').getContext('2d')
					},
					threshold: {
						red: $('canvas:threshold:red').getContext('2d'),
						green: $('canvas:threshold:green').getContext('2d'),
						blue: $('canvas:threshold:blue').getContext('2d'),
						composite: $('canvas:threshold:composite').getContext('2d')
					},

					// Get the image's pixel data of a given canvas context
					get: function(context) {
						return context.getImageData(0, 0, img.width, img.height);
					},

					// Put a given image pixel data on the given canvas context
					put: function(context, data) {
						context.putImageData(data, 0, 0);
					}
				};

				// Go through each intermediate image canvas and set it's height and width
				var canvases = ['orignal', 'noiseReduction', 'color:red', 'color:green', 'color:blue', 'threshold:composite', 'threshold:red', 'threshold:green', 'threshold:blue'];
				for(var canvas of canvases) {
					$('canvas:'+canvas).height = img.height,
					$('canvas:'+canvas).width = img.width;
				}

				// Draw the image on the original image canvas
				context.orignal.drawImage(img, 0, 0);

				// Update all the other intermediate image canvases
				canvas.update(['red','green','blue']);

				// Remove any previously set status
				$('status').textContent = '';
			};

			// Set the image url and show the image loading status to the user
			img.src = file;
			$('status').innerHTML = 'Loading Image&hellip;';
		},

		/*
			This function takes the orignal image and produces a noice
			reduced version of the image and places it on the noise
			reduction canvas. The noise reduction is done on the basis
			of the RGB slider values given by the user.
		*/
		noiseReduction: function() {

			// Get the pixel data of the orignal image
			var pixels = context.get(context.orignal);

			// Go through each pixel of the orignal image data
			for(var i = 0; i < pixels.data.length; i += 4) {

				// If the pixel's red value is less then the threshold given by the user then make it 0
				if(pixels.data[i] < color.red)
					pixels.data[i] = 0;

				// If the pixel's green value is less then the threshold given by the user then make it 0
				if(pixels.data[i + 1] < color.green)
					pixels.data[i + 1] = 0;

				// If the pixel's blue value is less then the threshold given by the user then make it 0
				if(pixels.data[i + 2] < color.blue)
					pixels.data[i + 2] = 0;
			}

			// Set the updated pixel data on the noise reduction canvas
			context.put(context.noiseReduction, pixels);
		},

		/*
			Inputs: colors - an array of colors that need to be updated

			This function goes through each given color and updates the
			corresponding color split canvas by removing any other color
			from the canvas pixel data. So the red canvas will only have
			red and other colors are made 0
		*/
		colorSplit: function(colors) {
			for(var k = 0; k < colors.length; k++) {
				var colorName = colors[k],
					otherColors = [];

				// Get the index of colors other than the one in current iteration
				if(colorName == 'red')
					otherColors = [1, 2];
				if(colorName == 'green')
					otherColors = [0, 2];
				else if(colorName == 'blue')
					otherColors = [0, 1];

				// Get the noise reduction canvas pixel data because that is used as the basis for color split canvases
				var pixels = context.get(context.noiseReduction);

				// Go through each pixel of the noise reduction canvas data
				for(var i = 0; i < pixels.data.length; i += 4) {

					// Set the value of the colors to 0
					pixels.data[i + otherColors[0]] = pixels.data[i + otherColors[1]] = 0;
				}

				// Set the updated pixel data on the color-split canvas of the current color
				context.put(context.color[colorName], pixels);
			}
		},

		/*
			Inputs: colors - An array of colors that need to be thresholded again

			This function updates the threshold valued of a given set of
			color split values and then regenerates the composite image
			from the new values
		*/
		threshold: function(colors) {

			// Go through each of the given colors that need to be updated and threshold the color's data
			for(var j = 0; j < colors.length; j++) {

				// Get the color's noise reduced color-split pixel data values
				var pixels = context.get(context.color[colors[j]]);

				// Go through each pixel of the fetched pixel data value
				for(var i = 0; i < pixels.data.length; i += 4) {

					// Set the RGB value of the pixel to 0, 0, 0 if it's above the user given color threshold and to 255, 255, 255 if it's below the threshold
					pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = (pixels.data[i + colorIndex[colors[j]]] > color[colors[j]]) ? 0 : 255;
				}

				// Put the color's thresholded data on it's threshold canvas
				context.put(context.threshold[colors[j]], pixels);
			}


			// Now that each individual color's data values have been thresholded we need to also regenereate the composite image

			// Get the pixel data values of each RGB color's thresholded images and also of the composite canvas itself
			var pixels = {
				red: context.get(context.threshold.red),
				green: context.get(context.threshold.green),
				blue: context.get(context.threshold.blue),
				composite: context.get(context.orignal)
			}

			// Go through each pixel of the composite image and make it black if any of the three RGB threshold values are black
			for(var i = 0; i < pixels.composite.data.length; i += 4) {

				// Make the RGB 0, 0, 0 if any of the corresponding pixels in the thresholded images were also black other wise make them 255, 255, 255
				pixels.composite.data[i] = pixels.composite.data[i + 1] = pixels.composite.data[i + 2] = (!pixels.red.data[i] || !pixels.green.data[i + 1] || !pixels.blue.data[i + 2]) ? 0 : 255;
			}

			// Set the regenrated composite image data values on the image canvas
			context.put(context.threshold.composite, pixels.composite);
		}
	},

	/*
		This function inverts the composite image. This is useful in
		cases that have light background over dark patches in the
		orignal image.
	*/
	invert: function() {

		// Get the pixel data value of the composite image
		var pixels = context.get(context.threshold.composite);

		// Go throughe each pixel of the image and make it black if it was white and vice versa
		for(var i = 0; i < pixels.data.length; i += 4) {
			pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = (pixels.data[i] == 255) ? 0 : 255;
		}

		// Set the inverted pixel data value on the composite image canvas
		context.put(context.threshold.composite, pixels);
	},

	/*
		Input: colors - An array of color names whose data need to be updates

		This function recalculates the pixel values of all the
		different types of intermediate image processing canvases.
	*/
	update: function(colors) {

		// Execute the noise reduction module
		canvas.paint.noiseReduction();

		// Execute the color split module for given colors
		canvas.paint.colorSplit(colors);

		// Execute the threshold module for given colors
		canvas.paint.threshold(colors);
	},

	/*
		This function executes the process of counting the patches
		by sending the composite pixel data values to the worker
		process and handling the necessery UI element changes.
	*/
	assess: function() {

		// Get the list of pixel data values of the composite image
		var pixels = context.get(context.threshold.composite);

		// Set the time to current time, this is later used to calculate how long it took to complete the task
		time = new Date;

		$('result:progress').style.display = 'block';
		$('result:progress').max = pixels.data.length / 4;

		/* Send the composite image pixel data values to the worker
		process along with the image width so that it can begin working
		on executing the patch count core algorithm. */
		worker.postMessage({context: pixels, width: $('canvas:orignal').width});
	}
};