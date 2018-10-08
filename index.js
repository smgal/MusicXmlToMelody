
var sax    = require('sax')
var events = require('events')
var util   = require('util')

const KEY_NAME = '#name';
const KEY_ATTR = '#attr';

function Chord()
{
}

function Note()
{
}

function Measure()
{
	this.index  = 0;
	this.chords = [];
	this.notes  = [];
}

function MusicXmlParser(settings)
{
	events.EventEmitter.call(this);

	this.sax = sax.parser(
		true,
		{
			trim      : false,
			normalize : false,
			xmlns     : false
		}
	);
	
	// Constants
	this.DURATION_STEP_IN_MEASURE = 480;

	// Public members
	this.measures = [];

	// Private members
	this.stack = [];
	this.measure_obj    = new Measure();

	// Methods
	this.sax.onopentag  = this.OnOpen.bind(this);
	this.sax.onclosetag = this.OnClose.bind(this);
	this.sax.ontext     = this.OnData.bind(this);
	this.sax.oncdata    = this.OnData.bind(this);
	this.sax.onerror    = this.OnError.bind(this);
}

util.inherits(MusicXmlParser, events.EventEmitter);

MusicXmlParser.prototype.OnOpen = function(node)
{
	var tag_name = node.name.toLowerCase();
	
	// TODO: process tag_name

	var entity = {};

	entity[KEY_NAME] = tag_name;

	for (var key in node.attributes)
	{
		// push the attributes to 'entity'
		if (!(KEY_ATTR in entity))
			entity[KEY_ATTR] = {};

		entity[KEY_ATTR][key] = node.attributes[key];

		// TODO: process XML tag
	}
  
	this.stack.push(entity);
};

MusicXmlParser.prototype.OnClose = function(node)
{
	var entity = this.stack.pop();
	var key = entity[KEY_NAME];
	var tag_name = node.toLowerCase();
	  
	// TODO: process tag_name

	delete entity[KEY_NAME];

	var parent = this.stack[this.stack.length - 1];

	if (entity && (typeof entity === 'object') && (Object.keys(entity).length == 0))
		entity = true;

	if (this.stack.length > 0)
	{
		if (key in parent)
		{
			parent[key] = util.isArray(parent[key]) ? parent[key] : [parent[key]];
			parent[key].push(entity);
		}
		else
		{
			parent[key] = entity;
		}
	}
	else
	{
		var result = {};
		result[key] = entity;

		this.emit('end', this.measures, result);
	}	

	// TODO:
};

MusicXmlParser.prototype.OnData = function(context)
{
	// TODO:
};

MusicXmlParser.prototype.OnError = function(error)
{
	this.emit('error', error);
};

MusicXmlParser.prototype.parse = function(string, internal_callback, user_callback)
{
	this.on('end', function(measures, sax_result)
	{
		internal_callback(null, measures, sax_result, user_callback);
	});

	this.on('error', user_callback);

	this.sax.write(string);
};

function ScoreDescriptor1_CB(error, measures, sax_output, user_callback)
{
	if (error)
	{
		user_callback(error, sax_output);
		return;
	}

	result = '';

	for (var ix in measures)
	{
		var measure = measures[ix];

		// TODO:
	}

	// for test
	user_callback(null, sax_output);
}

function ScoreDescriptor2_CB(error, measures, sax_output, user_callback)
{
	// TODO: TBD
	if (error)
	{
		user_callback(error, sax_output);
		return;
	}
}

exports.Run = function(stream, user_callback)
{
	var settings = { spec_version: 1 };

	if (typeof stream === 'object')
	{
		if (settings.spec_version < stream.spec_version)
			settings.spec_version = stream.spec_version;

		stream = stream.stream;
	}

	var mx_parser = new MusicXmlParser(settings);

	switch (settings.spec_version)
	{
	case 2:
		mx_parser.parse(stream, ScoreDescriptor2_CB, user_callback);
		break;
	case 1:
	default:
		mx_parser.parse(stream, ScoreDescriptor1_CB, user_callback);
		break;
	}
};
