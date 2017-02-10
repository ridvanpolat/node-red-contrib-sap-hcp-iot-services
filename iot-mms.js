"use strict";

var request = require('request');

module.exports = function (RED) {

  function HTTPRequest(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    var nodeAccount = n.account;
    var nodeDevice = n.device;
    var nodeToken = n.token;
    var nodeMType = n.mtype;
    var nodeMode = n.mode;
    if (n.mode) {
      var nodeMode = RED.nodes.getNode(n.mode);
    }
    
    if (RED.settings.httpRequestTimeout) {
      this.reqTimeout = parseInt(RED.settings.httpRequestTimeout) || 120000;
    } else {
      this.reqTimeout = 120000;
    }

    this.on("input", function (msg) {
      var preRequestTimestamp = process.hrtime();
      node.status({
        fill: "blue",
        shape: "dot",
        text: "httpin.status.requesting"
      });

      var sURL = "https://iotmms" + nodeAccount + ".hanatrial.ondemand.com/com.sap.iotservices.mms/v1/api/http/data/" + nodeDevice;
      var sMode = nodeMode ? "sync" : "async";
      var oBody = {
        mode: sMode,
        messageType: nodeMType,
        messages: [].concat(msg.payload)
      };
      
      var opts = {
        method: "POST",
        url: sURL,
        timeout: node.reqTimeout,
        body: oBody,
        headers: {
          "Authorization" : "Bearer " + nodeToken,
          "Content-Type" : "application/json;charset=utf-8"
        }
      };


      request(opts, function (error, response, body) {
        node.status({});
        if (error) {
          if (error.code === 'ETIMEDOUT') {
            node.error(RED._("common.notification.errors.no-response"), msg);
            setTimeout(function () {
              node.status({
                fill: "red",
                shape: "ring",
                text: "common.notification.errors.no-response"
              });
            }, 10);
          } else {
            node.error(error, msg);
            msg.payload = error.toString() + " : " + url;
            msg.statusCode = error.code;
            node.send(msg);
            node.status({
              fill: "red",
              shape: "ring",
              text: error.code
            });
          }
        } else {
          msg.payload = body;
          msg.headers = response.headers;
          if (node.metric()) {
            // Calculate request time
            var diff = process.hrtime(preRequestTimestamp);
            var ms = diff[0] * 1e3 + diff[1] * 1e-6;
            var metricRequestDurationMillis = ms.toFixed(3);
            node.metric("duration.millis", msg, metricRequestDurationMillis);
            if (response.connection && response.connection.bytesRead) {
              node.metric("size.bytes", msg, response.connection.bytesRead);
            }
          }
          node.send(msg);
        }
      })
    });
  }

  RED.nodes.registerType("iot-mms", HTTPRequest, {
    credentials: {}
  });
}
