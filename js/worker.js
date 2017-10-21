
// Listen for any messages form the front end by setting up a listener
addEventListener('message', function(e) {

	// If no data was send then terminate
	if(!e.data)
		return;

	var
		// To store the pixel data of the
		data = [],

		// Width of the given image, needed to calculate the neighbours of the pixels
		width = e.data.width,

		// An array of the pixels that have been checked in the algorithm
		known = [],

		// An array of patch sizes that have been found
		number = [],

		// To see how deep the algorithm's recursion function is going
		depth = 0;

	// Create a pixel wise array of the pixel data from the RGBA array provided by the front end process
	for(var i = 0; i < e.data.context.data.length; i += 4) {
		data.push(e.data.context.data[i]);
	}

	/*
		This function is the heart of the patch count algorith, it checks
		all the immidiate neighbours of any pixels and adds them to the known
		pixel list. Also if any of the neighbours is black then it checkes the
		neighbours of that pixel as well by using recursion.
	*/
	function checkNeighbour(j) {

		// Increment the depth counter
		depth++;

		// If the pixel has already been checked then skip the pixel
		if(known.indexOf(j) > -1)
			return;

		// Add the pixel to the list of known pixels that have already been checked
		known.push(j);

		// Get a list of the pixel's neighbours by using the martix represention of the image's pixel data and the image width
		var neighbours = [j-1, j+width-1, j+width, j+width+1, j+1, j-width+1, j-width, j-width-1];

		// Go through each neighbour and check if it's black or not
		for(var i = 0; i < neighbours.length; i++) {

			// If the neighbour is black and it's not already in the list of known pixels then call the function on that pixel as well
			if(data[neighbours[i]] == 0 && known.indexOf(neighbours[i]) < 0)
				checkNeighbour(neighbours[i]);
		}
	}

	// Try to catch any errors during the execution of the core algorithm so that we can gracefully fail and show the user the problem
	try {

		// Go through each pixel of the data sent by the front end
		for(var i = 0; i < data.length; i++) {

			// If the pixel is black and is not in the list of known (processed) pixels
			if(data[i] == 0 && known.indexOf(i) < 0) {

				// Then store the current size of the known list
				var old = known.length;
				depth = 0;

				// Initiate the neighbour checking recursive logic on the pixel
				checkNeighbour(i);

				/* Store the new length of the known pixel list minus old length to the patch size list
				   because the difference will be the number of new pixels the neighbour checking logic
				   found and hence the size of the patch as well. */
				number.push(known.length - old);
			}

			// If the pixel index is a multiple of 10 then send the progress update to the front end.
			// The multiple-of-10 check is done to reduce the request load on the front end.
			if(i % 10 == 0)
				postMessage({progress: true, found: number, done: i + 1});
		}

		// Send the finishing message along with an empty status signifying success and the number set of patches found
		postMessage({number: number, status: '', progress: false});
	} catch(e) {

		// Send the finishing message along with an error description and the number set of patches found in it's current state
		postMessage({number: number, status: e.message, progress: false});

		// Also log the current recurstion depth to the console
		console.log(depth);
	}
});