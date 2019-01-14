"use strict";
import { Kubectl } from "utility-common/kubectl-object-model";
import * as helper from './KubernetesObjectUtility';
import * as utils from "./utilities";
import path = require('path');
import fs = require("fs");

const BASELINE_SUFFIX = "-baseline";
const BASELINE_LABEL_VALUE = "baseline";
const CANARY_SUFFIX = "-canary";
const CANARY_LABEL_VALUE = "canary";
const CANARY_VERSION_LABEL = "azure-pipelines/version";

class KubernetesWorkload {
    static Pod = "Pod";
    static Replicaset = "Replicaset";
    static Deployment = "Deployment";
    static StatefulSet = "StatefulSet";
    static DaemonSet = "DaemonSet";
}

export class CanaryMetdata {
   input_object: any;
   stable_object: any;
   existing_canary_object: any;
   existing_baseline_object: any;
}

export function updateObjectLabelsForCanary(inputObject: any, newLabels: any){
    if (!newLabels){
            newLabels = new Map<string, string>();
    }
 
    // Add canary label
    newLabels[CANARY_VERSION_LABEL] = CANARY_LABEL_VALUE;
    inputObject.metadata.labels = newLabels;
}

export function updateObjectLabelsForBaseline(inputObject: any, newLabels: any){
    if (!newLabels){
            newLabels = new Map<string, string>();
    }
        
     // Add baseline label
    newLabels[CANARY_VERSION_LABEL] = BASELINE_LABEL_VALUE;
    inputObject.metadata.labels = newLabels;
}

export function calculateReplicaCountForCanary(inputObject: any, percentage: number){
    var inputReplicaCount = helper.getReplicaCount(inputObject);
    return Math.floor((inputReplicaCount*percentage)/100);
}

export function isDeploymentEntity(kind: string): boolean {
    if (!kind){
        throw new Error ("Kind is not defined");
    }
    
    var temp = kind.toUpperCase();
    return temp === KubernetesWorkload.Pod.toUpperCase() ||  
           temp === KubernetesWorkload.Replicaset.toUpperCase() ||  
           temp === KubernetesWorkload.Deployment.toUpperCase() ||  
           temp === KubernetesWorkload.StatefulSet.toUpperCase() ||  
           temp === KubernetesWorkload.DaemonSet.toUpperCase();
}

export function getNewBaselineResource(stableObject: any, replicas: number): object {
    return getNewCanaryObject(stableObject, replicas, BASELINE_LABEL_VALUE);
}

export function getNewCanaryResource(inputObject: any, replicas: number): object {
    return getNewCanaryObject(inputObject, replicas, CANARY_LABEL_VALUE);
}

function getNewCanaryObject(inputObject: any, replicas: number, type: string): object {
    var newObject = JSON.parse(JSON.stringify(inputObject));

    // Updating name
    newObject.metadata.name = type === CANARY_LABEL_VALUE ? getCanaryResourceName(inputObject.metadata.name) : 
                                                            getBaselineResourceName(inputObject.metadata.name);

    // Adding labels and annotations.
    addCanaryLabelsAndAnnotations(newObject, type);
    
    // Updating no. of replicas
    if (newObject.kind.toUpperCase() != KubernetesWorkload.Pod.toUpperCase() && 
        newObject.kind.toUpperCase() != KubernetesWorkload.DaemonSet.toUpperCase()){
        newObject.spec.replicas = replicas;
    }

    return newObject;
}

function addCanaryLabelsAndAnnotations(inputObject: any, type: string){
    var newLabels = new Map<string, string>();
    newLabels[CANARY_VERSION_LABEL] = type;                                                  
    
    helper.updateObjectLabels(inputObject, newLabels, false);
    helper.updateSelectorLabels(inputObject, newLabels, false);
    helper.updatePodLabels(inputObject, newLabels, false);
    helper.updateObjectAnnotations(inputObject, newLabels, false);
}

export function applyResource(kubectl: Kubectl, inputObjects: any[]){
    let newFilePaths = [];
    inputObjects.forEach((inputObject: any) => {
        var filePath = inputObject.kind+ "_"+ inputObject.metadata.name;
        var inputObjectString = JSON.stringify(inputObject);
        const tempDirectory = utils.getTempDirectory();
        let fileName = path.join(tempDirectory, path.basename(filePath));
           fs.writeFileSync(
           path.join(fileName),
           inputObjectString);
        newFilePaths.push(fileName);
    });

    return kubectl.apply(newFilePaths);
}

export function fetchResource(kubectl: Kubectl, kind: string, name: string): object {
    var result = kubectl.getResource(kind, name);
    return result.stderr ? null : JSON.parse(result.stdout);
}

export function fetchCanaryResource(kubectl: Kubectl, kind: string, name: string): object {
    return fetchResource(kubectl, kind, getCanaryResourceName(name));
}

export function fetchBaselineResource(kubectl: Kubectl, kind: string, name: string): object {
    return fetchResource(kubectl, kind, getBaselineResourceName(name));
}

function getCanaryResourceName(name: string){
     return name+CANARY_SUFFIX;
}

function getBaselineResourceName(name: string){
    return name+BASELINE_SUFFIX;
}