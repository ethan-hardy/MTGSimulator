'use strict';
(function() {
    // $('#playButton').click(function() {
    //     window.location.href = '../../game.html';
    // })
    var socket = io();
    var currentUser, currentDecklists = [];
    const valForNewDeck = -1, valForChallengeAFriend = -2;

    let delta = $(document).height() - $(window).height();
    $('.deckListEntry').each(function() {
        $(this).height($(this).height() - delta);
    });

    $('#okButton').on('click', function() {
        topLayerClick({target: $('#topLayer')[0]});
    });

    socket.on('receiveChallenge', function(challengerUsername) {
        showPopUpWithIdSelector('#challengePopUp', false);
        $('#challengeMessage').text(challengerUsername + " is challenging you!");
        $('#acceptChallengeButton').on('click', function() { //acceptOrDeclineChallenge', function(challengeIniatorUsername, challegeResponderUsername, challengeWasAccepted)
            socket.emit('acceptOrDeclineChallenge', challengerUsername, currentUser.username, true);
            $(this).unbind('click');
            topLayerClick({target: $('#topLayer')[0]});
            sessionStorage.yourUsername = currentUser.username;
            sessionStorage.opponentUsername = challengerUsername;
            sessionStorage.isTheHost = "false";
            // sessionStorage[currentUser.username] = JSON.stringify({isHost: "false", opponentUsername: challengerUsername});
            $('#playButton')[0].click();
        });
        $('#declineChallengeButton').on('click', function() { //acceptOrDeclineChallenge', function(challengeIniatorUsername, challegeResponderUsername, challengeWasAccepted)
            socket.emit('acceptOrDeclineChallenge', challengerUsername, currentUser.username, false);
            $(this).unbind('click');
        });
    });

    socket.on('receiveChallengeResponse', function(challengeWasAccepted, challegeResponderUsername) {
        if (!challengeWasAccepted) {
            showPopUpWithIdSelector('#notificationPopUp', true);
            $('#notificationMessage').text(challegeResponderUsername + " declined your challenge..");
            $('#loadingSection').css({'display': 'none'});
        }
        else {
            showPopUpWithIdSelector('#notificationPopUp', true);
            $('#notificationMessage').text(challegeResponderUsername + " accepted your challenge!");
            $('#loadingSection').css({'display': 'none'});


            sessionStorage.opponentUsername = challegeResponderUsername;
            sessionStorage.yourUsername = currentUser.username;
            sessionStorage.isTheHost = "true";

            // sessionStorage[currentUser.username] = JSON.stringify({isHost: "true", opponentUsername: challegeResponderUsername});

            $('#playButton')[0].click();
        }
    });

    function showPopUpWithIdSelector(popIdSelector, outsideClickShouldEscape) { //popIdSelector should include the #, as it is a selector
        $('#topLayer').css({opacity: 0.0, visibility: "visible"}).animate({opacity: 1.0}, {duration: 100});
        $('.popUp').css({'display': 'none'});
        $(popIdSelector).css({'display': 'block'});
        if (outsideClickShouldEscape) {
            $('#topLayer').on('click', topLayerClick);
        }
    }

    $('.deckSelect').change(function() {
        var queryText = '#yourSide ';
        if ($.contains($('#oppSide')[0], this)) {
            queryText = '#oppSide ';
            if ($('#oppDeckListEntry').css('display') == 'none') {
                $('#oppDeckListEntry').css({'display': 'block'});
                $('#challengeAFriendSection').css({'display': 'none'});
                $('#oppSide .deckTitle').prop('readonly', false);
            }
        }
        var list, nameToPut = $(this).find(':selected').text();

        for (var deck of currentDecklists) {
            if (nameToPut == deck.deckName) {
                list = deck.deckList;
                break;
            }
        }

        var widthName = nameToPut;

        if ($(this).val() < 0) {
            if ($(this).val() == valForNewDeck) nameToPut = '';
            else if ($(this).val() == valForChallengeAFriend) {
                $('#oppSide .deckTitle').prop('readonly', true);
                $('#oppDeckListEntry').css({'display': 'none'});
                $('#challengeAFriendSection').css({'display': 'block'});
            }
            $(queryText + '.deleteButton').css({'display': 'none'});
        }
        else {
            $(queryText + '.deleteButton').css({'display': 'inline-block'});
        }

        $(queryText + '.deckTitle').val(nameToPut);
        $(queryText + '.deckListEntry').val(list);

        var wid = $('#hiddenSelect').empty().append($('<option>', {
            value: widthName,
            text: widthName
        })).width();

        $(this).width(wid);

    }).each(function() {
        $(this).append($('<option>', {
            value: valForNewDeck,
            text: 'New deck'
        }));

        if ($.contains($('#oppSide')[0], this)) {
            $(this).append($('<option>', {
                value: valForChallengeAFriend,
                text: 'Challenge a friend'
            }));
        }

        var wid = $('#hiddenSelect').empty().append($('<option>', {
            value: 'New deck',
            text: 'New deck'
        })).width();

        $(this).width(wid);
    });

    $('#signin').click(function() {
        if ($(this).text().indexOf('Sign In') !== -1) {
            showPopUpWithIdSelector('#signInPopUp', true);
            $('#usernameInput').focus();
        }
        else
            signOut();
    });

    function topLayerClick(e) {
        $(e.target).animate({opacity: 0.0}, {duration: 80, complete: function() {
            $(this).css({opacity: 1.0, visibility: "hidden"});
        }});
        $('.errorText').each(function() {
            $(this).css({opacity: 1.0, visibility: "hidden"});
        });
        $(e.target).unbind('click');
    }

    $('#topLayer').click(topLayerClick);

    $('.popUp').click(function(e) {
        e.stopImmediatePropagation();
    });

    $('.popUp').each(function() {
        $(this).offset({
            top: ($(window).height() - $(this).height()) / 2, left: $(this).offset().left
        });
    });

    $('#playButton').click(function() {
        sessionStorage.yourListText = $('#yourSide .deckListEntry').val().toLowerCase();
        sessionStorage.oppListText = $('#oppSide .deckListEntry').val().toLowerCase();
    });

    $('#challengeButton').click(function() {
        socket.emit('challengeAFriend', currentUser.username, $('#friendUsernameInput').val(), function(err) {
            if (err !== undefined) {
                alert(err);
            }
            else {
                $('#loadingSection').css({'display': 'block'});
            }
        });
    });

    function signOut() {
        currentUser = null;
        currentDecklists = [];
        $('#oppSide .deckSelect')
            .empty()
            .append($('<option>', {
                    value: valForNewDeck,
                    text: 'New deck'
            }), $('<option>', {
                    value: valForChallengeAFriend,
                    text: 'Challenge a friend'
            }))
            .trigger('change');
        $('#yourSide .deckSelect')
            .empty()
            .append($('<option>', {
                    value: valForNewDeck,
                    text: 'New deck'
            }))
            .trigger('change');

        $('.deckListEntry').each(function() {
            $(this).val('');
        });
        $('.deckTitle').each(function() {
            $(this).val('');
        });
        $('#usernameLabel').text('');
        $('#signin').text('Sign In');
    }

    function configureUser(deckLists, user, errMessage) { //deckLists has type [{deckID: _ , deckName: _ , deckList: _ }]
        if (errMessage === null || errMessage === undefined) {                    //user is {userID: _ , username: _ }
            currentUser = user;
            currentDecklists = deckLists;
            $('#usernameLabel').text(user.username);
            $('#signin').text('Sign Out');
            $('#topLayer').trigger('click');
            $('.deckSelect').each(function() {
                for (var deck of currentDecklists) {
                    $(this).append($('<option>', {
                        value: deck.deckID,
                        text: deck.deckName
                    }));
                }
            });
            $('#usernameInput').val('');
            $('#passwordInput').val('');
        }
        else if (errMessage === 'Unrecognized username') {
            $('#usernameInput').val('');
            $('#usernameError').css({opacity: 0.0, visibility: "visible"}).animate({opacity: 1.0}, {duration: 100});
        }
        else if (errMessage === 'Incorrect password'){
            $('#passwordInput').val('');
            $('#passwordError').css({opacity: 0.0, visibility: "visible"}).animate({opacity: 1.0}, {duration: 100});
        }
        else {
            alert(errMessage.code);
        }
    }

    $('#signInFromPopUp').click(function() {
        socket.emit('signInWithInfo', $('#usernameInput').val(), $('#passwordInput').val(), configureUser);
        $('.errorText').each(function() {
            $(this).css({opacity: 1.0, visibility: "hidden"});
        });
    });

    $('#signUpFromPopUp').click(function() {
        socket.emit('signUpWithInfo', $('#usernameInput').val(), $('#passwordInput').val(), configureUser);
        $('#usernameInput').val('');
        $('#passwordInput').val('');
        $('.errorText').each(function() {
            $(this).css({opacity: 1.0, visibility: "hidden"});
        });
    });

    $('.popUpInput').keyup(function(e) {
        if (e.keyCode == 13) {
            $('#signInFromPopUp').trigger('click');
        }
    });

    $('.saveButton').click(function() {
        if (currentUser !== null && currentUser !== undefined) {
            var queryText = '#oppSide ';
            if ($.contains($('#yourSide')[0], this)) queryText = '#yourSide ';
            var name = $(queryText+'.deckTitle').val(), list = $(queryText+'.deckListEntry').val(), deckID = $(queryText + '.deckSelect').val();
            socket.emit('saveDeck', deckID, name, list, currentUser, function(response) {
                alert(response.code);
                if (response.code !== 'Saved') return;
                var selectedDeck = {deckID: Math.max(response.id, deckID), deckName: name, deckList: list};
                if (deckID < 0) {
                    currentDecklists.push(selectedDeck);
                    $('.deckSelect').each(function() {
                        $(this).append($('<option>', {
                            value: response.id,
                            text: name
                        }));
                        if ($.contains($(queryText)[0], this)) {
                            $(this).val(response.id);
                        }
                        $(this).trigger('change');
                    });
                }
                else {
                    for (var deck of currentDecklists) {
                        if (deck.deckID == deckID) {
                            currentDecklists[currentDecklists.indexOf(deck)] = selectedDeck;
                            break;
                        }
                    }
                    // $(queryText + '.deckSelect').find(':selected').text(name);
                    $('.deckSelect option').each(function() {
                        if ($(this).val() == deckID) {
                            $(this).text(name);
                            $(this).parent().trigger('change');
                        }
                    });
                }
            });
        }
    });
    $('.deleteButton').click(function() {
        if (currentUser !== null && currentUser !== undefined) {
            var queryText = '#oppSide ';
            if ($.contains($('#yourSide')[0], this)) queryText = '#yourSide ';
            var deckID = $(queryText + '.deckSelect').val();
            if (deckID < 0) return;
            socket.emit('deleteDeck', deckID, function(response) {
                alert(response.code);
                if (response.code !== 'Deleted') return;
                let optionToRemove;
                $('#yourSide .deckSelect').children().each(function() {
                    if ($(this).val() == deckID) {
                        optionToRemove = this;
                    }
                });
                $(optionToRemove).remove();
                $('#oppSide .deckSelect').children().each(function() {
                    if ($(this).val() == deckID) {
                        optionToRemove = this;
                    }
                });
                $(optionToRemove).remove();
                //$('.deckListEntry').val('');
                $('.deckSelect').trigger('change');
            });
        }
    });
})();
