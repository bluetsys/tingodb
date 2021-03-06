var _ = require("lodash");
var Buffer = require("safe-buffer").Buffer;

// Binary default subtype
var BSON_BINARY_SUBTYPE_DEFAULT = 0;

/**
 * Convert Array ot Uint8Array to Binary String
 *
 * @ignore
 * @api private
 */
var convertArraytoUtf8BinaryString = function (byteArray, startIndex, endIndex) {
	var result = "";
	for (var i = startIndex; i < endIndex; i++) {
		result = result + String.fromCharCode(byteArray[i]);
	}
	return result;
};

/**
 * A class representation of the BSON Binary type.
 *
 * Sub types
 *  - **BSON.BSON_BINARY_SUBTYPE_DEFAULT**, default BSON type.
 *  - **BSON.BSON_BINARY_SUBTYPE_FUNCTION**, BSON function type.
 *  - **BSON.BSON_BINARY_SUBTYPE_BYTE_ARRAY**, BSON byte array type.
 *  - **BSON.BSON_BINARY_SUBTYPE_UUID**, BSON uuid type.
 *  - **BSON.BSON_BINARY_SUBTYPE_MD5**, BSON md5 type.
 *  - **BSON.BSON_BINARY_SUBTYPE_USER_DEFINED**, BSON user defined type.
 *
 * @class Represents the Binary BSON type.
 * @param {Buffer} buffer a buffer object containing the binary data.
 * @param {Number} [subType] the option binary type.
 * @return {Grid}
 */
function Binary(buffer, subType) {
	if (!(this instanceof Binary)) return new Binary(buffer, subType);
	this._bsontype = 'Binary';

	if (_.isNumber(buffer)) {
		this.sub_type = buffer;
		this.position = 0;
	} else {
		this.sub_type = subType == null ? BSON_BINARY_SUBTYPE_DEFAULT : subType;
		this.position = 0;
	}

	if (buffer != null && !_.isNumber(buffer)) {
		// Only accept Buffer, Uint8Array or Arrays
		if (_.isString(buffer)) {
			// Different ways of writing the length of the string for the different types
			this.buffer = new Buffer(buffer);
		} else {
			this.buffer = buffer;
		}
		this.position = buffer.length;
	} else {
		this.buffer = new Buffer(Binary.BUFFER_SIZE);
		// Set position to start of buffer
		this.position = 0;
	}
}

/**
 * Updates this binary with byte_value.
 *
 * @param {Character} byte_value a single byte we wish to write.
 * @api public
 */
Binary.prototype.put = function put(byte_value) {
	// If it's a string and a has more than one character throw an error
	if (byte_value['length'] != null && !_.isNumber(byte_value) && byte_value.length != 1) throw new Error("only accepts single character String, Uint8Array or Array");
	if (!_.isNumber(byte_value) && byte_value < 0 || byte_value > 255) throw new Error("only accepts number in a valid unsigned byte range 0-255");

	// Decode the byte value once
	var decoded_byte = null;
	if (_.isString(byte_value)) {
		decoded_byte = byte_value.charCodeAt(0);
	} else if (byte_value['length'] != null) {
		decoded_byte = byte_value[0];
	} else {
		decoded_byte = byte_value;
	}

	if (this.buffer.length > this.position) {
		this.buffer[this.position++] = decoded_byte;
	} else {
		var buffer;

		if (Buffer.isBuffer(this.buffer)) {
			// Create additional overflow buffer
			buffer = new Buffer(Binary.BUFFER_SIZE + this.buffer.length);
			// Combine the two buffers together
			this.buffer.copy(buffer, 0, 0, this.buffer.length);
			this.buffer = buffer;
			this.buffer[this.position++] = decoded_byte;
		} else {
			buffer = null;
			// Create a new buffer (typed or normal array)
			if (Buffer.isBuffer(this.buffer)) {
				buffer = new Uint8Array(new ArrayBuffer(Binary.BUFFER_SIZE + this.buffer.length));
			} else {
				buffer = new Array(Binary.BUFFER_SIZE + this.buffer.length);
			}

			// We need to copy all the content to the new array
			for (var i = 0; i < this.buffer.length; i++) {
				buffer[i] = this.buffer[i];
			}

			// Reassign the buffer
			this.buffer = buffer;
			// Write the byte
			this.buffer[this.position++] = decoded_byte;
		}
	}
};

/**
 * Writes a buffer or string to the binary.
 *
 * @param {Buffer|String} string a string or buffer to be written to the Binary BSON object.
 * @param {Number} offset specify the binary of where to write the content.
 * @api public
 */
Binary.prototype.write = function write(string, offset) {
	offset = _.isNumber(offset) ? offset : this.position;

	// If the buffer is to small let's extend the buffer
	if (this.buffer.length < offset + string.length) {
		var buffer = null;
		// If we are in node.js
		if (Buffer.isBuffer(this.buffer)) {
			buffer = new Buffer(this.buffer.length + string.length);
			this.buffer.copy(buffer, 0, 0, this.buffer.length);
		} else if (Buffer.isBuffer(this.buffer)) {
			// Create a new buffer
			buffer = new Uint8Array(new ArrayBuffer(this.buffer.length + string.length));
			// Copy the content
			for (var i = 0; i < this.position; i++) {
				buffer[i] = this.buffer[i];
			}
		}

		// Assign the new buffer
		this.buffer = buffer;
	}

	if (Buffer.isBuffer(string) && Buffer.isBuffer(this.buffer)) {
		string.copy(this.buffer, offset, 0, string.length);
		this.position = (offset + string.length) > this.position ? (offset + string.length) : this.position;
		// offset = string.length
	} else if (_.isString(string) && Buffer.isBuffer(this.buffer)) {
		this.buffer.write(string, 'binary', offset);
		this.position = (offset + string.length) > this.position ? (offset + string.length) : this.position;
		// offset = string.length;
	} else if (Buffer.isBuffer(string) || _.isArray(string) && !_.isString(string)) {
		for (var k = 0; k < string.length; k++) {
			this.buffer[offset++] = string[k];
		}

		this.position = offset > this.position ? offset : this.position;
	} else if (_.isString(string)) {
		for (var j = 0; j < string.length; j++) {
			this.buffer[offset++] = string.charCodeAt(j);
		}

		this.position = offset > this.position ? offset : this.position;
	}
};

/**
 * Reads **length** bytes starting at **position**.
 *
 * @param {Number} position read from the given position in the Binary.
 * @param {Number} length the number of bytes to read.
 * @return {Buffer}
 * @api public
 */
Binary.prototype.read = function read(position, length) {
	length = length && length > 0 ?
		length :
		this.position;

	// Let's return the data based on the type we have
	if (this.buffer['slice']) {
		return this.buffer.slice(position, position + length);
	}

	// Create a buffer to keep the result
	var buffer = new Uint8Array(new ArrayBuffer(length));
	for (var i = 0; i < length; i++) {
		buffer[i] = this.buffer[position++];
	}

	// Return the buffer
	return buffer;
};

/**
 * Returns the value of this binary as a string.
 *
 * @return {String}
 * @api public
 */
Binary.prototype.value = function value(asRaw) {
	asRaw = asRaw == null ? false : asRaw;

	// If it's a node.js buffer object
	if (Buffer.isBuffer(this.buffer)) {
		return asRaw ? this.buffer.slice(0, this.position) : this.buffer.toString('binary', 0, this.position);
	}

	if (asRaw) {
		// we support the slice command use it
		if (this.buffer['slice'] != null) {
			return this.buffer.slice(0, this.position);
		}

		// Create a new buffer to copy content to
		var newBuffer = Buffer.isBuffer(this.buffer) ? new Uint8Array(new ArrayBuffer(this.position)) : new Array(this.position);
		// Copy content
		for (var i = 0; i < this.position; i++) {
			newBuffer[i] = this.buffer[i];
		}
		// Return the buffer
		return newBuffer;
	}

	return convertArraytoUtf8BinaryString(this.buffer, 0, this.position);
};

/**
 * Length.
 *
 * @return {Number} the length of the binary.
 * @api public
 */
Binary.prototype.length = function length() {
	return this.position;
};

/**
 * @ignore
 * @api private
 */
Binary.prototype.toJSON = function () {
	return this.buffer != null ? this.buffer.toString('base64') : '';
};

/**
 * @ignore
 * @api private
 */
Binary.prototype.toString = function (format) {
	return this.buffer != null ? this.buffer.slice(0, this.position).toString(format) : '';
};

Binary.BUFFER_SIZE = 256;

/**
 * Default BSON type
 *
 * @classconstant SUBTYPE_DEFAULT
 **/
Binary.SUBTYPE_DEFAULT = 0;
/**
 * Function BSON type
 *
 * @classconstant SUBTYPE_DEFAULT
 **/
Binary.SUBTYPE_FUNCTION = 1;
/**
 * Byte Array BSON type
 *
 * @classconstant SUBTYPE_DEFAULT
 **/
Binary.SUBTYPE_BYTE_ARRAY = 2;
/**
 * OLD UUID BSON type
 *
 * @classconstant SUBTYPE_DEFAULT
 **/
Binary.SUBTYPE_UUID_OLD = 3;
/**
 * UUID BSON type
 *
 * @classconstant SUBTYPE_DEFAULT
 **/
Binary.SUBTYPE_UUID = 4;
/**
 * MD5 BSON type
 *
 * @classconstant SUBTYPE_DEFAULT
 **/
Binary.SUBTYPE_MD5 = 5;
/**
 * User BSON type
 *
 * @classconstant SUBTYPE_DEFAULT
 **/
Binary.SUBTYPE_USER_DEFINED = 128;

/**
 * Expose.
 */
exports.Binary = Binary;
