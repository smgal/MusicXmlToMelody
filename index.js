
var sax    = require('sax')
var events = require('events')
var util   = require('util')

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
	this.measure_obj    = new Measure();

	// Methods
	this.sax.onopentag  = this.OnOpen.bind(this);
	this.sax.onclosetag = this.OnClose.bind(this);
	this.sax.ontext     = this.OnData.bind(this);
	this.sax.oncdata    = this.OnData.bind(this);
	this.sax.onerror    = this.OnError.bind(this);
}

util.inherits(MusicXmlParser, events.EventEmitter);

MusicXmlParser.prototype.OnOpen = function(error)
{
	// TODO:
};

MusicXmlParser.prototype.OnClose = function(error)
{
	// TODO:
};

MusicXmlParser.prototype.OnData = function(error)
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

function ScoreDescriptor1_CB(err, measures, sax_output, user_callback)
{
	if (error)
	{
		user_callback(error, sax_output);
		return;
	}
}

function ScoreDescriptor2_CB(error, measures, sax_output, user_callback)
{
	// TODO: TBD
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
