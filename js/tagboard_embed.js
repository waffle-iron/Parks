(function(window){
	var embedIDs = 1,
		scrollTimer = -1,
		previousHeight = {},

		con = {
			log: function(s){console.log(s);},
			warn: function(s){console.warn?console.warn(s):console.log(s);},
			error: function(s){console.error?console.error(s):console.log(s);}
		},
		tgbDivs = (function(){
			var divs = [],
				elems = document.getElementsByClassName('tagboard-embed');
			for (var i = 0; i < elems.length; ++i) {
				if (elems[i].nodeName === 'DIV') {
					divs.push(elems[i]);
				}
			}
			return divs;
		})(),
		tgbDomain = (window.tagboardOptions && window.tagboardOptions.domain) || window.tagboardDomain || "https://tagboard.com",

		pageScrolled = function _pageScrolled() {
			if (scrollTimer != -1) {
				clearTimeout(scrollTimer);
			}

			scrollTimer = window.setTimeout(scrollFinished, 50);
		},

		execForFrames = function _execForFrame(func, frame_id) {
			// Optional frame_id to run for specific embed frame
			var iframes = document.getElementsByClassName('tagboard-iframe');
			for (var i = 0; i < iframes.length; ++i) {
				var ifrm = iframes[i],
					match = ifrm.getAttribute('tgb-frame-id') == frame_id;
				if (ifrm.tagName.toLowerCase() === 'iframe' && (!frame_id || match)) {
					func(ifrm);
					if (frame_id) {
						return;
					}
				}
			}
		},

		scrollFinished = function _scrollFinished(frame_id) {
			execForFrames(function(ifrm){
				var divYOffset = 0;

				for (var element = ifrm; element != null; element = element.offsetParent) {
					divYOffset += element.offsetTop;
				}

				ifrm.contentWindow.postMessage('scrollPos:' + Math.max(0, window.pageYOffset - divYOffset), tgbDomain);
			}, frame_id);
		},

		setFrameHeight = function _setFrameHeight(height, frame_id){
			execForFrames(function(ifrm){
				if(ifrm.getAttribute('fixed-height') != 1) {
					var prev = parseInt(ifrm.style.height, 10),
						newHeight = height,
						event = document.createEvent("CustomEvent");

					if (height < prev && previousHeight[frame_id] !== height) { newHeight = prev;	}

					ifrm.style.height = newHeight + "px";

					// Fire off event only if height has changed
					if(previousHeight[frame_id] !== height) {
						event.initCustomEvent("tgb.embedHeight", true, true, { height: height, iframe: ifrm }); // Because IE
						window.dispatchEvent(event);
					}

					previousHeight[frame_id] = height;
				}
			}, frame_id);
		},

		tagboardAuthWindow,
		authRequested = function _authRequested(network, doConnect) {
			var top = (window.innerHeight / 2) - 300;
				left = (window.innerWidth / 2) - 400,
				authUrl = tgbDomain + "/u/auth_child?network=" + network + "&connect=" + (doConnect ? "1" : "");
			tagboardAuthWindow = window.open(authUrl, "tgbauthwin", "width=800,height=600,resizable=1,location=1,top="+top+",left="+left);
			// check for window open fail - i.e. pop-up blocker doing it's thing
			if (!tagboardAuthWindow) {
				return window.tagboardAuthComplete(false, "The sign-in window was blocked due to a popup blocker. Please allow it to be opened and try again.");
			}

			function checkChild() {
				if (tagboardAuthWindow.closed) {
					return window.tagboardAuthComplete(true);
				}
				setTimeout(checkChild, 500);
			}

			checkChild();
		},

		insertIFrame = function _insertIFrame(div, options) {
			var opts = [],
				embedID = embedIDs++;

			if (options.mobilePostCount) { opts.push('mpc=' + options.mobilePostCount); }
			if (options.postCount) { opts.push('pc=' + options.postCount); }
			if (options.darkMode) { opts.push('dm=' + !!options.darkMode); }
			if (options.autoLoad) { opts.push('al=' + !!options.autoLoad); }
			if (options.inlineMedia) { opts.push('im=' + !!options.inlineMedia); }
			if (options.moderate) { opts.push('md=' + !!options.moderate); }

			opts.push('id='+embedID);
			opts.push('ver='+options.version);
			opts = '#' + opts.join('&');

			var ifrm = document.createElement("IFRAME");
			ifrm.setAttribute("src", tgbDomain + "/" + options.tagboard + "/embed" + opts);
			ifrm.setAttribute("onload", "tagboardQueryHeight("+embedID+")");
			ifrm.setAttribute("frameborder", "0");
			if (options.version < 3) { ifrm.id="tagboard-iframe"; iframe = ifrm; }
			ifrm.setAttribute("class", "tagboard-iframe");
			ifrm.setAttribute("tgb-frame-id", embedID);
			ifrm.name="tagboard";
			ifrm.setAttribute("style", "width:100%;");
			if (options.fixedHeight) {
				ifrm.setAttribute("fixed-height", "1");
				ifrm.style.height = "100%";
			} else {
				ifrm.style.height = "600px"; // Default initial height
				ifrm.setAttribute("scrolling", "no");
			}
			div.appendChild(ifrm);
		},

		handleFrameMessage = function _handleFrameMessage(e) {
			if (e.origin == tgbDomain) {
				var dataObj = {};
				e.data.split('&').forEach(function(e){
					var d = e.split(':');
					dataObj[d[0]] = d.length > 1 ? d[1] : d[0];
				});

				if (dataObj.height) {
					setFrameHeight(parseInt(dataObj.height), dataObj.frame_id);
				}

				if (dataObj.auth) {
					authRequested(dataObj.auth, dataObj.frame_id);
				}
			}
		};

	if ((window.tagboard && typeof window.tagboard === 'string') || (window.tagboardOptions && window.tagboardOptions.tagboard)) {
		var tagboardOptions = window.tagboardOptions || {};
		tagboardOptions.tagboard = tagboardOptions.tagboard || window.tagboard;

		if (window.tagboard) {
			tagboardOptions.version = 1;
			con.error("Using deprecated version of Tagboard embed. Update embed code. http://support.tagboard.com/82998");
		} else {
			tagboardOptions.version = 2;
			con.warn("Using an out-of-date version of Tagboard embed. Please update embed code. http://support.tagboard.com/82998");
		}

		try {
			insertIFrame(document.getElementById("tagboard-embed"), tagboardOptions);
		} catch (e) {
			con.error("Exception generating iFrame for tagboard embed: ", e);
			return;
		}
	} else if (tgbDivs.length > 0) {
		tgbDivs.forEach(function(div){
			var options = {
				tagboard: div.getAttribute('tgb-slug'),
				version: 3,
				mobilePostCount: div.getAttribute('tgb-mobile-count'),
				postCount: div.getAttribute('tgb-post-count'),
				darkMode: div.getAttribute('tgb-dark-mode') === 'true',
				autoLoad: div.getAttribute('tgb-auto-load') === 'true',
				fixedHeight: div.getAttribute('tgb-fixed-height') === 'true',
				inlineMedia: div.getAttribute('tgb-inline-media') === 'true',
				moderate: div.getAttribute('tgb-mod') === 'true'
			};
			if (options.tagboard) {
				insertIFrame(div, options);
			}
		});
	} else {
		con.error("Tagboard script expected DIV with class: 'tagboard-embed'");
		return;
	}

	window.tagboardQueryHeight = function queryHeight(frame_id) {
		execForFrames(function(ifrm){
			ifrm.contentWindow.postMessage('height?', tgbDomain);
			scrollFinished(frame_id);
		}, frame_id);
	};

	window.tagboardAuthComplete = function _tagboardAuthComplete(success, failMessage) {
		var authMessage = ["authComplete", success ? "1" : "", failMessage].join(":");
		// close the auth child window
		tagboardAuthWindow && typeof tagboardAuthWindow.close === "function" && tagboardAuthWindow.close();
		// notify the embed of the auth status

		execForFrames(function(ifrm){
			ifrm.contentWindow.postMessage(authMessage, tgbDomain);
		});
	};

	window.handleFrameMessage = handleFrameMessage;
	window.pageScrolled = pageScrolled;

	window.addEventListener('message', window.handleFrameMessage, false);
	window.addEventListener('scroll', window.pageScrolled, false);

	if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
		window.addEventListener('resize', function() {
			execForFrames(function(ifrm){
				ifrm.style.width = ifrm.parentNode.clientWidth + "px";
				setTimeout(function(){ ifrm.style.width = "100%"; }, 2500);
			});
		}, true);
	}

})(window);