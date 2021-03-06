var organic = require("organic");
var path = require("path");
var fs = require("fs");
var async = require("async")
var _ = require("underscore")
var home = require("home-dir")
var format = require("string-template")
var Reactor = require("./src/reactor")
var Loader = require("./src/loader")

var resolveArrayOverrides = require("resolve-array-overrides")
var resolveReferences = require("organic-dna-resolvereferences")


module.exports = function Angel(dna){
  var self = this
  var sources = [ 
    path.join(process.cwd(), "dna"),
    path.join(process.cwd(), "angel.json"),
    path.join(home(), "angel.json"),
    path.join(home(), "angel", "dna")
  ]

  this.plasma = new organic.Plasma();
  this.reactor = new Reactor()
  this.abilities = new Loader(function(){
    return self
  })
  this.scripts = new Loader(function(){
    return self.clone()
  })

  if(dna === false)
    return self.start()

  if(!dna) {
    async.detectSeries(sources, fs.exists, function(found){
      if(found)
        self.loadDnaByPath(found, function(dna){
          self.start(dna)
        })
      else
        self.start()
    })
  } else
  if(typeof dna == "string") {
    this.loadDnaByPath(dna, function(dna){
      self.start(dna)
    })
  }
  else
    this.start(dna)
}

module.exports.prototype.loadDnaByPath = function(p, next) {
  var dna = new organic.DNA()
  fs.exists(p, function(found){
    if(!found) return next(dna)

    if(path.extname(p) == ".json") {
      dna.loadFile(p, function(){
        next(dna)
      })
    } else {
      dna.loadDir(p, function(){
        next(dna)
      })
    }
  })
}

module.exports.prototype.start = function(dna){
  var dna = dna instanceof organic.DNA?dna:new organic.DNA(dna)
  resolveReferences(dna)
  var angelDNA = dna
  if(dna.angel)
    angelDNA = new organic.DNA(dna.angel)
  if(angelDNA.index) {
    resolveArrayOverrides(angelDNA, "index")
    angelDNA.mergeBranchInRoot("index")
  }
  organic.Cell.call(this, angelDNA);
  
  this.dna = dna
  this.angelDNA = angelDNA
  this.plasma.emit({"type": "build", branch: "membrane"})
  this.plasma.emit({"type": "build", branch: "plasma"})

  var self = this
  self.abilities.load(angelDNA.abilities || [], function(err){
    if(err) return console.error(err)
    self.scripts.load(angelDNA.scripts || [], function(err){
      if(err) return console.error(err)
      process.nextTick(function(){
        self.plasma.emit({type: "ready"})    
      })  
    })
  })
}

module.exports.prototype.loadScript = function(script, done) {
  self.scripts.loadScript(script, done)
}

module.exports.prototype.loadScripts = function(){
  var self = this
  self.scripts = new Loader(function(){
    return self.clone()
  })
  self.scripts.load.apply(self.scripts, arguments)
}

module.exports.prototype.clone = function(){
  return _.extend({}, this)
}

module.exports.prototype.on = function(pattern, handler) {
  var self = this
  return this.reactor.on(pattern, function(cmdData, next){
    handler(_.extend(self.clone(), {cmdData: cmdData}), next)
  })
}

module.exports.prototype.once = function(pattern, handler) {
  var self = this
  return this.reactor.once(pattern, function(cmdData, next){
    handler(_.extend(self.clone(), {cmdData: cmdData}), next)
  })
}

module.exports.prototype.do = function(input, next) {
  if(next)
    return this.reactor.do(format(input, this.cmdData), next)
  return function(angel, next){
    angel.reactor.do(format(input, angel.cmdData), next)
  }
}

module.exports.prototype.render = function(err, data) {
  if(err)
    console.error(err, data)
  else
    console.log(data)
}