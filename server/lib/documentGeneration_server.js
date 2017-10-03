import { Meteor } from 'meteor/meteor';

const fs = require('fs-extra');
const path = require('path');

createDocumentStoragePath = function (fileObj) { //eslint-disable-line
    if (Meteor.isServer) { 
        let absoluteDocumentPath = getDocumentStorageRootDirectory(); //eslint-disable-line
        // optionally: append sub directory for parent meeting series and year if a minute is given
        if (fileObj && fileObj.meta && fileObj.meta.minuteId) {
            absoluteDocumentPath =  absoluteDocumentPath + '/' + fileObj.meta.meetingSeriesId; 
            let minuteYear = new Date(fileObj.meta.minuteDate).getFullYear(); 
            absoluteDocumentPath =  absoluteDocumentPath + '/' + minuteYear;
        }
        // create target dir for document storage if it does not exist 
        fs.ensureDirSync(absoluteDocumentPath, function (err) { 
            if (err) { 
                console.error('ERROR: Could not create path for protocol storage: ' + absoluteDocumentPath); 
            } 
        }); 
        return absoluteDocumentPath; 
    }
};

//This function will delete the DocumentStoragePath with each subdirectory in it
//It is used within the E2E-Tests to reset the app
resetDocumentStorageDirectory = function() { //eslint-disable-line
    let storagePath = getDocumentStorageRootDirectory(); //eslint-disable-line
    if (fs.existsSync(storagePath)) {
        fs.emptyDir(storagePath);
    }
};

getDocumentStorageRootDirectory = () => { //eslint-disable-line
    let absoluteDocumentPath = Meteor.settings.docGeneration && Meteor.settings.docGeneration.targetDocPath 
        ? Meteor.settings.docGeneration.targetDocPath 
        : 'protocols'; 
    // make path absolute 
    if (!path.isAbsolute(absoluteDocumentPath)) { 
        absoluteDocumentPath = path.resolve(absoluteDocumentPath); 
    }
    return absoluteDocumentPath;
};

// check storagePath for protocols once at server bootstrapping
// also check necessary binaries for pdf generation
if (Meteor.settings.docGeneration && Meteor.settings.docGeneration.enabled) {
    console.log('Document generation feature: ENABLED');
    let settingsPath = createDocumentStoragePath(undefined); //eslint-disable-line
    let absoluteTargetPath = path.resolve(settingsPath);
    console.log('Document Storage Path: ' + absoluteTargetPath);

    fs.access(absoluteTargetPath, fs.W_OK, function(err) {
        if(err){
            console.error('*** ERROR*** No write access to Document Storage Path');
            console.error('             Documents can not be saved.');
            console.error('             Ensure write access to path specified in your settings.json');
            console.error('             Current Document Storage Path setting is: ' + absoluteTargetPath);
            // Now switch off feature!
            Meteor.settings.docGeneration.enabled = false;
            console.log('Document generation feature: DISABLED');
        } else {
            console.log('OK, has write access to Document Storage Path');
            //Check pdf binaries
            if ((Meteor.settings.docGeneration.format === 'pdf') || (Meteor.settings.docGeneration.format === 'pdfa')) {
                checkCondition((Meteor.settings.docGeneration.pathToWkhtmltopdf), 'No path for wkhtmltopdf is assigned within settings.json.');
                checkCondition(fs.existsSync(Meteor.settings.docGeneration.pathToWkhtmltopdf), 'Missing binary for wkhtmltopdf at path: ' + Meteor.settings.docGeneration.pathToWkhtmltopdf);
                if (Meteor.settings.docGeneration.format === 'pdfa') {
                    checkCondition((Meteor.settings.docGeneration.pathToGhostscript), 'No path for ghostscript is assigned within settings.json.');
                    checkCondition(fs.existsSync(Meteor.settings.docGeneration.pathToGhostscript), 'Missing binary for ghostscript at path: ' + Meteor.settings.docGeneration.pathToGhostscript);
                    checkCondition((Meteor.settings.docGeneration.pathToPDFADefinitionFile) && ((Meteor.settings.docGeneration.ICCProfileType === 'rgb') || (Meteor.settings.docGeneration.ICCProfileType === 'cmyk')), 
                        'Both a path to a pdfa definition file and a valid ICC profile type have to be assigned in the settings.json');
                    checkCondition(fs.existsSync(Meteor.settings.docGeneration.pathToPDFADefinitionFile), 'Could not find PDFA definition file at path: ' + Meteor.settings.docGeneration.pathToPDFADefinitionFile);
                }
            }
        }
    });
} else {
    console.log('Document generation feature: DISABLED');
}

let checkCondition = (condition, errorMessage) => {
    if (Meteor.settings.docGeneration.enabled) {
        if (!condition) {
            console.error('*** ERROR*** '+ errorMessage);
            console.error('             Document generation feature: DISABLED');
            Meteor.settings.docGeneration.enabled = false;
        }
    }
};