// Declare a variable to hold the serial port object
let port;
// Declare a variable to hold the writer so we can send data to Arduino
let writer;
// Declare a variable to hold the decoder that turns bytes into text
const decoder = new TextDecoder();

// Declare a string buffer to collect text chunks until a full line arrives
let readBuffer = "";

// Declare variables to store joystick and mode values from Arduino
let joyX = 512;
// Declare variable for joystick Y value with initial center
let joyY = 512;
// Declare variable for mode value zero or one
let mode = 0;

// Declare color variables for background and circle
let bgColor;
// Declare color variable for circle fill
let circleColor;

// Define setup function called once by p5 at start
function setup() {
  // Create a canvas of width six hundred and height four hundred
  createCanvas(600, 400);

  // Set initial background color to a dark blue
  bgColor = color(15, 20, 40);
  // Set initial circle color to cyan
  circleColor = color(0, 200, 255);

  // Create a button for starting serial connection to Arduino
  const connectButton = createButton('Connect to Arduino');
  // Position the button near the top left corner of the canvas
  connectButton.position(10, 10);
  // Assign a function so that button press will call connectSerial
  connectButton.mousePressed(connectSerial);

  // Set text size for on screen labels
  textSize(14);
}

// Define draw function which runs many times per second in p5
function draw() {
  // Paint the background with current background color
  background(bgColor);

  // Map joystick X value from zero to one thousand twenty three to canvas X range
  const mappedX = map(joyX, 0, 1023, 50, width - 50);
  // Map joystick Y value from zero to one thousand twenty three to canvas Y range
  const mappedY = map(joyY, 0, 1023, 50, height - 50);

  // Change colors if mode is one to indicate pressed mode on Arduino
  if (mode === 0) {
    // Set background color for normal mode
    bgColor = color(15, 20, 40);
    // Set circle color for normal mode
    circleColor = color(0, 200, 255);
  } else {
    // Set background color for alternate mode when button toggled
    bgColor = color(40, 10, 10);
    // Set circle color for alternate mode when button toggled
    circleColor = color(255, 180, 0);
  }

  // Turn off stroke so circle has no outline
  noStroke();
  // Apply current circle color as fill
  fill(circleColor);
  // Draw circle at mapped joystick position with fixed diameter
  circle(mappedX, mappedY, 80);

  // Set fill color to white for text labels
  fill(255);
  // Draw text showing joystick X raw value on top left
  text('Joystick X: ' + joyX, 10, 60);
  // Draw text showing joystick Y raw value on top left
  text('Joystick Y: ' + joyY, 10, 80);
  // Draw text showing current mode value and how it changes
  text('Mode: ' + mode + ' (toggled by joystick button)', 10, 100);
  // Draw text to explain that mouse X controls LED brightness
  text('Move mouse left or right to change LED brightness', 10, 120);
  // Draw text to explain that space bar sends a blink command
  text('Press space to blink LED once', 10, 140);
}

// Define an async function that connects to the serial port when button is pressed
async function connectSerial() {
  // Check if the serial feature is available in this browser
  if (!('serial' in navigator)) {
    // Show alert if serial is not available
    alert('WebSerial is not supported in this browser');
    // Stop function because we cannot continue without serial
    return;
  }

  // Use try catch to handle connection errors
  try {
    // Ask user to select the Arduino serial port
    port = await navigator.serial.requestPort();
    // Open the selected port at baud rate of nine thousand six hundred
    await port.open({ baudRate: 9600 });
    // Get a writer from the writable stream of the port
    writer = port.writable.getWriter();
    // Start the read loop that listens for incoming data
    readLoop();
  } catch (err) {
    // Log any connection error to the console for debugging
    console.error('Serial connection error:', err);
  }
}

// Define async function that keeps reading data from serial port
async function readLoop() {
  // Continue reading as long as the port has a readable stream
  while (port.readable) {
    // Create a reader object for the readable stream
    const reader = port.readable.getReader();
    // Use try block to handle read errors
    try {
      // Enter infinite loop to read chunks until done
      while (true) {
        // Await a chunk of data from serial input
        const { value, done } = await reader.read();
        // If done is true then exit the inner loop
        if (done) {
          // Break out of read loop if stream is closed
          break;
        }
        // If we received a value then decode it to text
        if (value) {
          // Decode binary data to text using the decoder object
          const chunk = decoder.decode(value, { stream: true });
          // Append decoded text to read buffer string
          readBuffer += chunk;
          // Split buffer into lines using newline character
          let lines = readBuffer.split('\n');
          // Keep last item of array as partial line for future data
          readBuffer = lines.pop();
          // Loop over all complete lines and handle them
          for (let line of lines) {
            // Trim white space from both ends of line
            line = line.trim();
            // Pass clean line to function that parses serial protocol
            handleSerialLine(line);
          }
        }
      }
    } catch (err) {
      // Log any error that happens during reading
      console.error('Serial read error:', err);
    } finally {
      // Release reader lock so new reader can be created later
      reader.releaseLock();
    }
  }
}

// Define function to parse and use each serial line from Arduino
function handleSerialLine(line) {
  // If line is empty then ignore it and return early
  if (!line) return;

  // Split incoming text line by comma character into parts array
  const parts = line.split(',');
  // Check for expected format J,x,y,B,mode with at least five parts
  if (parts.length >= 5 && parts[0] === 'J' && parts[3] === 'B') {
    // Convert second part to integer for joystick X
    joyX = int(parts[1]);
    // Convert third part to integer for joystick Y
    joyY = int(parts[2]);
    // Convert fifth part to integer for mode value
    mode = int(parts[4]);
  }
}

// Define helper function to send a text line plus newline to Arduino
async function sendLine(text) {
  // If writer is not ready then do nothing
  if (!writer) return;
  // Create a new encoder to convert text to bytes
  const encoder = new TextEncoder();
  // Encode text plus newline into Uint8Array
  const data = encoder.encode(text + '\n');
  // Write encoded bytes to serial port using writer
  await writer.write(data);
}

// Define function called by p5 when mouse moves
function mouseMoved() {
  // Only send brightness if serial writer is ready
  if (!writer) return;
  // Map mouse X coordinate to brightness zero to two hundred fifty five
  const brightness = int(map(mouseX, 0, width, 0, 255));
  // Build command string for LED brightness with leading L
  const command = 'L,' + brightness;
  // Send brightness command line to Arduino
  sendLine(command);
}

// Define function called by p5 when key is pressed
function keyPressed() {
  // Check if pressed key is space character
  if (key === ' ') {
    // Send BLINK command line to Arduino to request one blink
    sendLine('BLINK');
  }
}
