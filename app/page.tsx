'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useCVTask } from '@/hooks/useCVTask'
import GuidedModelFlow from '@/components/GuidedModelFlow'
import CameraPreview from '@/components/CameraPreview'
import ResultsDisplay from '@/components/ResultsDisplay'
import ParallelModelTester from '@/components/ParallelModelTester'
import { ModelMetadata } from '@/types/models'
import { modelViewStore } from '@/stores/modelViewStore'
import { Github, ExternalLink, Sparkles, ArrowRight, Info, ArrowLeft } from 'lucide-react'
import LidVizionIcon from '@/components/LidVizionIcon'
import TaskTypeSelectDropdown from '@/components/TaskTypeSelectDropdown'
import KeypointDetectionUI from '@/components/KeypointDetectionUI'

export default function Home() {
  const router = useRouter()
  const [selectedModel, setSelectedModel] = useState<ModelMetadata | null>(null)
  const { currentTask, processImage, isProcessing, lastResponse, compressionInfo } = useCVTask(selectedModel)

  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [showMoreModels, setShowMoreModels] = useState(false)
  const [selectedTaskType, setSelectedTaskType] = useState<'detection' | 'classification' | 'segmentation' | 'keypoint-detection'>('detection')

  // Featured models for quick testing (all task types)
  const featuredModels: ModelMetadata[] = [
    {
      id: 'gemini-2.0-flash-exp',
      name: 'Gemini 2.0 Flash Exp',
      description: 'Google\'s experimental ultra-fast multimodal AI model',
      task: 'multimodal',
      source: 'curated',
      author: 'Google',
      downloads: 0,
      tags: [],
      frameworks: [],
      modelUrl: 'https://ai.google.dev/models/gemini',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: '/api/gemini-inference',
      status: 'active',
      isDisabled: false,
      provider: 'google'
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      description: 'Google\'s fast multimodal AI model',
      task: 'multimodal',
      source: 'curated',
      author: 'Google',
      downloads: 0,
      tags: [],
      frameworks: [],
      modelUrl: 'https://ai.google.dev/models/gemini',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: '/api/gemini-inference',
      status: 'active',
      isDisabled: false,
      provider: 'google'
    },
    {
      id: 'gemini-2.5-flash-lite',
      name: 'Gemini 2.5 Flash Lite',
      description: 'Google\'s ultra-fast lightweight multimodal AI model',
      task: 'multimodal',
      source: 'curated',
      author: 'Google',
      downloads: 0,
      tags: [],
      frameworks: [],
      modelUrl: 'https://ai.google.dev/models/gemini',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: '/api/gemini-inference',
      status: 'active',
      isDisabled: false,
      provider: 'google'
    },
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      description: 'Google\'s balanced multimodal AI model',
      task: 'multimodal',
      source: 'curated',
      author: 'Google',
      downloads: 0,
      tags: [],
      frameworks: [],
      modelUrl: 'https://ai.google.dev/models/gemini',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: '/api/gemini-inference',
      status: 'active',
      isDisabled: false,
      provider: 'google'
    },
    {
      id: 'gemini-3-pro',
      name: 'Gemini 3 Pro',
      description: 'Google\'s most accurate multimodal AI model',
      task: 'multimodal',
      source: 'curated',
      author: 'Google',
      downloads: 0,
      tags: [],
      frameworks: [],
      modelUrl: 'https://ai.google.dev/models/gemini',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: '/api/gemini-inference',
      status: 'active',
      isDisabled: false,
      provider: 'google'
    },
    {
      id: 'facebook/detr-resnet-101',
      name: 'DETR ResNet-101',
      description: 'Facebook\'s DETR object detection model with ResNet-101 backbone',
      task: 'object-detection',
      source: 'huggingface',
      author: 'Facebook',
      downloads: 1000000,
      tags: ['object-detection', 'detr'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/facebook/detr-resnet-101',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://api-inference.huggingface.co/models/facebook/detr-resnet-101',
      status: 'active',
      isDisabled: false,
      provider: 'huggingface'
    },
    {
      id: 'facebook/detr-resnet-50',
      name: 'DETR ResNet-50',
      description: 'Facebook\'s DETR object detection model with ResNet-50 backbone',
      task: 'object-detection',
      source: 'huggingface',
      author: 'Facebook',
      downloads: 2000000,
      tags: ['object-detection', 'detr'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/facebook/detr-resnet-50',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://api-inference.huggingface.co/models/facebook/detr-resnet-50',
      status: 'active',
      isDisabled: false,
      provider: 'huggingface'
    },
    {
      id: 'microsoft/resnet-50',
      name: 'ResNet-50',
      description: 'Microsoft\'s ResNet-50 image classification model',
      task: 'image-classification',
      source: 'huggingface',
      author: 'Microsoft',
      downloads: 5000000,
      tags: ['image-classification', 'resnet'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/microsoft/resnet-50',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://api-inference.huggingface.co/models/microsoft/resnet-50',
      status: 'active',
      isDisabled: false,
      provider: 'huggingface'
    },
    {
      id: 'google/vit-base-patch16-224',
      name: 'Vision Transformer (ViT) Base',
      description: 'State-of-the-art Vision Transformer for image classification. Trained on ImageNet-21k, excellent accuracy.',
      task: 'image-classification',
      source: 'huggingface',
      author: 'Google',
      downloads: 4050416,
      tags: ['vision', 'transformer', 'classification', 'imagenet', 'google', 'sota'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/google/vit-base-patch16-224',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://router.huggingface.co/hf-inference/models/google/vit-base-patch16-224',
      status: 'active',
      isDisabled: false,
      provider: 'huggingface'
    },
    {
      id: 'google/efficientnet-b0',
      name: 'EfficientNet B0',
      description: 'Fast and efficient CNN for image classification. Excellent balance between speed and accuracy.',
      task: 'image-classification',
      source: 'huggingface',
      author: 'Google',
      downloads: 863403,
      tags: ['efficientnet', 'classification', 'fast', 'efficient', 'google', 'mobile'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/google/efficientnet-b0',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://router.huggingface.co/hf-inference/models/google/efficientnet-b0',
      status: 'active',
      isDisabled: false,
      provider: 'huggingface'
    },
    {
      id: 'facebook/convnext-tiny-224',
      name: 'ConvNeXt Tiny',
      description: 'Modern pure ConvNet. Lightweight and efficient with modern training techniques.',
      task: 'image-classification',
      source: 'huggingface',
      author: 'Facebook',
      downloads: 1403276,
      tags: ['convnext', 'classification', 'modern-cnn', 'facebook', 'meta', 'fast'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/facebook/convnext-tiny-224',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://router.huggingface.co/hf-inference/models/facebook/convnext-tiny-224',
      status: 'active',
      isDisabled: false,
      provider: 'huggingface'
    },
    {
      id: 'facebook/convnext-base-224',
      name: 'ConvNeXt Base',
      description: 'Larger ConvNeXt model for higher accuracy. Modern CNN with strong performance on ImageNet.',
      task: 'image-classification',
      source: 'huggingface',
      author: 'Facebook',
      downloads: 0,
      tags: ['convnext', 'classification', 'modern-cnn', 'facebook', 'meta', 'accurate'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/facebook/convnext-base-224',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://router.huggingface.co/hf-inference/models/facebook/convnext-base-224',
      status: 'active',
      isDisabled: false,
      provider: 'huggingface'
    },
    {
      id: 'microsoft/beit-base-patch16-224-pt22k-ft22k',
      name: 'BEiT Base',
      description: 'Microsoft Vision Transformer using masked image modeling. Pre-trained on ImageNet-22k.',
      task: 'image-classification',
      source: 'huggingface',
      author: 'Microsoft',
      downloads: 982211,
      tags: ['beit', 'vision-transformer', 'classification', 'microsoft', 'imagenet'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/microsoft/beit-base-patch16-224-pt22k-ft22k',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://router.huggingface.co/hf-inference/models/microsoft/beit-base-patch16-224-pt22k-ft22k',
      status: 'active',
      isDisabled: false,
      provider: 'huggingface'
    },
    {
      id: 'apple/mobilevit-small',
      name: 'MobileViT Small',
      description: 'Apple mobile-optimized vision transformer. Designed for on-device inference with low latency.',
      task: 'image-classification',
      source: 'huggingface',
      author: 'Apple',
      downloads: 1532816,
      tags: ['mobilevit', 'mobile', 'classification', 'apple', 'edge', 'fast'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/apple/mobilevit-small',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://router.huggingface.co/hf-inference/models/apple/mobilevit-small',
      status: 'active',
      isDisabled: false,
      provider: 'huggingface'
    },
    {
      id: 'facebook/maskformer-swin-large-ade',
      name: 'MaskFormer Swin Large',
      description: 'Facebook MaskFormer with Swin Transformer backbone. State-of-the-art semantic segmentation on ADE20k (150 classes).',
      task: 'image-segmentation',
      source: 'huggingface',
      author: 'Facebook',
      downloads: 1766,
      tags: ['segmentation', 'maskformer', 'swin', 'facebook', 'meta', 'ade20k', 'semantic'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/facebook/maskformer-swin-large-ade',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://router.huggingface.co/hf-inference/models/facebook/maskformer-swin-large-ade',
      status: 'active',
      isDisabled: false,
      provider: 'huggingface'
    },
    {
      id: 'nvidia/segformer-b0-finetuned-ade-512-512',
      name: 'SegFormer B0 - Scene Segmentation',
      description: 'NVIDIA SegFormer for scene segmentation on ADE20k (150 classes).',
      task: 'image-segmentation',
      source: 'huggingface',
      author: 'NVIDIA',
      downloads: 212434,
      tags: ['segmentation', 'scene-understanding', 'segformer', 'nvidia', 'ade20k'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/nvidia/segformer-b0-finetuned-ade-512-512',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://router.huggingface.co/hf-inference/models/nvidia/segformer-b0-finetuned-ade-512-512',
      status: 'active',
      isDisabled: false,
      provider: 'huggingface'
    },
    {
      id: 'facebook/detr-resnet-50-panoptic',
      name: 'DETR Panoptic Segmentation',
      description: 'Panoptic segmentation combining instance + semantic segmentation for full-scene understanding.',
      task: 'image-segmentation',
      source: 'huggingface',
      author: 'Facebook',
      downloads: 54178,
      tags: ['segmentation', 'panoptic', 'detr', 'facebook', 'meta'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/facebook/detr-resnet-50-panoptic',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://router.huggingface.co/hf-inference/models/facebook/detr-resnet-50-panoptic',
      status: 'active',
      isDisabled: false,
      provider: 'huggingface'
    },
    {
      id: 'meta/sam-segment-anything',
      name: 'SAM (Segment Anything Model)',
      description: 'Meta\'s Segment Anything Model - state-of-the-art segmentation. Redirects to Meta AI Demos studio.',
      task: 'image-segmentation',
      source: 'curated',
      author: 'Meta',
      downloads: 0,
      tags: ['segmentation', 'sam', 'meta', 'facebook', 'segment-anything'],
      frameworks: [],
      modelUrl: 'https://aidemos.meta.com/segment-anything/',
      platforms: [],
      supportsInference: false,
      status: 'active',
      isDisabled: false,
      provider: 'meta'
    },
    // Anthropic Claude Models - Coming Soon
    {
      id: 'anthropic/claude-3-haiku',
      name: 'Claude 3 Haiku',
      description: 'Anthropic\'s fastest Claude model for vision tasks. Fast and efficient multimodal AI.',
      task: 'multimodal',
      source: 'curated',
      author: 'Anthropic',
      downloads: 0,
      tags: ['claude', 'anthropic', 'multimodal', 'vision'],
      frameworks: [],
      modelUrl: 'https://www.anthropic.com/claude',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'anthropic',
      comingSoonReason: 'Anthropic API integration pending'
    },
    {
      id: 'anthropic/claude-3.7-sonnet',
      name: 'Claude 3.7 Sonnet',
      description: 'Anthropic\'s balanced Claude model with enhanced vision capabilities.',
      task: 'multimodal',
      source: 'curated',
      author: 'Anthropic',
      downloads: 0,
      tags: ['claude', 'anthropic', 'multimodal', 'vision'],
      frameworks: [],
      modelUrl: 'https://www.anthropic.com/claude',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'anthropic',
      comingSoonReason: 'Anthropic API integration pending'
    },
    {
      id: 'anthropic/claude-4-opus',
      name: 'Claude 4 Opus',
      description: 'Anthropic\'s most capable Claude model for advanced vision tasks.',
      task: 'multimodal',
      source: 'curated',
      author: 'Anthropic',
      downloads: 0,
      tags: ['claude', 'anthropic', 'multimodal', 'vision'],
      frameworks: [],
      modelUrl: 'https://www.anthropic.com/claude',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'anthropic',
      comingSoonReason: 'Anthropic API integration pending'
    },
    {
      id: 'anthropic/claude-4-sonnet',
      name: 'Claude 4 Sonnet',
      description: 'Anthropic\'s advanced Claude model with strong vision understanding.',
      task: 'multimodal',
      source: 'curated',
      author: 'Anthropic',
      downloads: 0,
      tags: ['claude', 'anthropic', 'multimodal', 'vision'],
      frameworks: [],
      modelUrl: 'https://www.anthropic.com/claude',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'anthropic',
      comingSoonReason: 'Anthropic API integration pending'
    },
    {
      id: 'anthropic/claude-4.1-opus',
      name: 'Claude 4.1 Opus',
      description: 'Enhanced Claude 4 Opus with improved vision capabilities.',
      task: 'multimodal',
      source: 'curated',
      author: 'Anthropic',
      downloads: 0,
      tags: ['claude', 'anthropic', 'multimodal', 'vision'],
      frameworks: [],
      modelUrl: 'https://www.anthropic.com/claude',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'anthropic',
      comingSoonReason: 'Anthropic API integration pending'
    },
    {
      id: 'anthropic/claude-4.5-haiku',
      name: 'Claude 4.5 Haiku',
      description: 'Latest fast Claude model with enhanced vision understanding.',
      task: 'multimodal',
      source: 'curated',
      author: 'Anthropic',
      downloads: 0,
      tags: ['claude', 'anthropic', 'multimodal', 'vision'],
      frameworks: [],
      modelUrl: 'https://www.anthropic.com/claude',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'anthropic',
      comingSoonReason: 'Anthropic API integration pending'
    },
    {
      id: 'anthropic/claude-4.5-sonnet',
      name: 'Claude 4.5 Sonnet',
      description: 'Latest balanced Claude model with advanced vision capabilities.',
      task: 'multimodal',
      source: 'curated',
      author: 'Anthropic',
      downloads: 0,
      tags: ['claude', 'anthropic', 'multimodal', 'vision'],
      frameworks: [],
      modelUrl: 'https://www.anthropic.com/claude',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'anthropic',
      comingSoonReason: 'Anthropic API integration pending'
    },
    // OpenAI Models - Coming Soon
    {
      id: 'openai/gpt-4o',
      name: 'GPT-4o',
      description: 'OpenAI\'s advanced multimodal model with vision capabilities.',
      task: 'multimodal',
      source: 'curated',
      author: 'OpenAI',
      downloads: 0,
      tags: ['gpt-4', 'openai', 'multimodal', 'vision'],
      frameworks: [],
      modelUrl: 'https://openai.com/gpt-4',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'openai',
      comingSoonReason: 'OpenAI API integration pending'
    },
    // Microsoft Models - Coming Soon
    {
      id: 'microsoft/florence-2',
      name: 'Florence-2',
      description: 'Microsoft\'s advanced vision-language model for comprehensive image understanding.',
      task: 'multimodal',
      source: 'curated',
      author: 'Microsoft',
      downloads: 0,
      tags: ['florence', 'microsoft', 'vision-language', 'multimodal'],
      frameworks: [],
      modelUrl: 'https://huggingface.co/microsoft/Florence-2-base-ft',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'microsoft',
      comingSoonReason: 'Microsoft Florence-2 API integration pending'
    },
    // Google Models - Coming Soon
    {
      id: 'google/gemma-3-4b',
      name: 'Gemma 3 4B',
      description: 'Google\'s efficient 4B parameter vision-language model.',
      task: 'multimodal',
      source: 'curated',
      author: 'Google',
      downloads: 0,
      tags: ['gemma', 'google', 'vision-language', 'multimodal'],
      frameworks: [],
      modelUrl: 'https://ai.google.dev/gemma',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'google',
      comingSoonReason: 'Google Gemma API integration pending'
    },
    {
      id: 'google/gemma-3-12b',
      name: 'Gemma 3 12B',
      description: 'Google\'s balanced 12B parameter vision-language model.',
      task: 'multimodal',
      source: 'curated',
      author: 'Google',
      downloads: 0,
      tags: ['gemma', 'google', 'vision-language', 'multimodal'],
      frameworks: [],
      modelUrl: 'https://ai.google.dev/gemma',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'google',
      comingSoonReason: 'Google Gemma API integration pending'
    },
    {
      id: 'google/gemma-3-27b',
      name: 'Gemma 3 27B',
      description: 'Google\'s powerful 27B parameter vision-language model.',
      task: 'multimodal',
      source: 'curated',
      author: 'Google',
      downloads: 0,
      tags: ['gemma', 'google', 'vision-language', 'multimodal'],
      frameworks: [],
      modelUrl: 'https://ai.google.dev/gemma',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'google',
      comingSoonReason: 'Google Gemma API integration pending'
    },
    {
      id: 'google/vision-ocr',
      name: 'Google Vision OCR',
      description: 'Google Cloud Vision API for optical character recognition and text extraction.',
      task: 'ocr',
      source: 'curated',
      author: 'Google',
      downloads: 0,
      tags: ['ocr', 'google', 'text-extraction', 'vision'],
      frameworks: [],
      modelUrl: 'https://cloud.google.com/vision',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'google',
      comingSoonReason: 'Google Cloud Vision API integration pending'
    },
    // Meta Llama Models - Coming Soon
    {
      id: 'meta/llama-3.2-vision-11b',
      name: 'Llama 3.2 Vision 11B',
      description: 'Meta\'s efficient 11B parameter vision-language model.',
      task: 'multimodal',
      source: 'curated',
      author: 'Meta',
      downloads: 0,
      tags: ['llama', 'meta', 'vision-language', 'multimodal'],
      frameworks: [],
      modelUrl: 'https://llama.meta.com',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'meta',
      comingSoonReason: 'Meta Llama Vision API integration pending'
    },
    {
      id: 'meta/llama-3.2-vision-90b',
      name: 'Llama 3.2 Vision 90B',
      description: 'Meta\'s powerful 90B parameter vision-language model.',
      task: 'multimodal',
      source: 'curated',
      author: 'Meta',
      downloads: 0,
      tags: ['llama', 'meta', 'vision-language', 'multimodal'],
      frameworks: [],
      modelUrl: 'https://llama.meta.com',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'meta',
      comingSoonReason: 'Meta Llama Vision API integration pending'
    },
    {
      id: 'meta/llama-4-maverick',
      name: 'Llama 4 Maverick',
      description: 'Meta\'s latest Llama 4 model with advanced vision capabilities.',
      task: 'multimodal',
      source: 'curated',
      author: 'Meta',
      downloads: 0,
      tags: ['llama', 'meta', 'vision-language', 'multimodal'],
      frameworks: [],
      modelUrl: 'https://llama.meta.com',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'meta',
      comingSoonReason: 'Meta Llama 4 API integration pending'
    },
    {
      id: 'meta/llama-4-scout',
      name: 'Llama 4 Scout',
      description: 'Meta\'s Llama 4 Scout model optimized for vision tasks.',
      task: 'multimodal',
      source: 'curated',
      author: 'Meta',
      downloads: 0,
      tags: ['llama', 'meta', 'vision-language', 'multimodal'],
      frameworks: [],
      modelUrl: 'https://llama.meta.com',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'meta',
      comingSoonReason: 'Meta Llama 4 API integration pending'
    },
    // Mistral AI Models - Coming Soon
    {
      id: 'mistral/small-3.1-24b',
      name: 'Mistral Small 3.1 24B',
      description: 'Mistral\'s efficient 24B parameter vision-language model.',
      task: 'multimodal',
      source: 'curated',
      author: 'Mistral AI',
      downloads: 0,
      tags: ['mistral', 'vision-language', 'multimodal'],
      frameworks: [],
      modelUrl: 'https://mistral.ai',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'mistral',
      comingSoonReason: 'Mistral API integration pending'
    },
    {
      id: 'mistral/medium-3.1',
      name: 'Mistral Medium 3.1',
      description: 'Mistral\'s balanced vision-language model with strong performance.',
      task: 'multimodal',
      source: 'curated',
      author: 'Mistral AI',
      downloads: 0,
      tags: ['mistral', 'vision-language', 'multimodal'],
      frameworks: [],
      modelUrl: 'https://mistral.ai',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'mistral',
      comingSoonReason: 'Mistral API integration pending'
    },
    {
      id: 'mistral/pixtral-12b',
      name: 'Pixtral 12B',
      description: 'Mistral\'s specialized vision model for image understanding.',
      task: 'multimodal',
      source: 'curated',
      author: 'Mistral AI',
      downloads: 0,
      tags: ['pixtral', 'mistral', 'vision', 'multimodal'],
      frameworks: [],
      modelUrl: 'https://mistral.ai',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'mistral',
      comingSoonReason: 'Mistral Pixtral API integration pending'
    },
    // xAI Models - Coming Soon
    {
      id: 'xai/grok-4',
      name: 'Grok 4',
      description: 'xAI\'s advanced multimodal model with vision capabilities.',
      task: 'multimodal',
      source: 'curated',
      author: 'xAI',
      downloads: 0,
      tags: ['grok', 'xai', 'multimodal', 'vision'],
      frameworks: [],
      modelUrl: 'https://x.ai',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'xai',
      comingSoonReason: 'xAI Grok API integration pending'
    },
    // Qwen Models - Coming Soon
    {
      id: 'qwen/qwen-vl-max',
      name: 'Qwen VL Max',
      description: 'Alibaba\'s powerful vision-language model for comprehensive image understanding.',
      task: 'multimodal',
      source: 'curated',
      author: 'Alibaba',
      downloads: 0,
      tags: ['qwen', 'vision-language', 'multimodal'],
      frameworks: [],
      modelUrl: 'https://qwenlm.github.io',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'qwen',
      comingSoonReason: 'Qwen API integration pending'
    },
    {
      id: 'qwen/qwen2.5-vl-7b-instruct',
      name: 'Qwen2.5-VL-7B-Instruct',
      description: 'Alibaba\'s efficient 7B parameter vision-language model with instruction following.',
      task: 'multimodal',
      source: 'curated',
      author: 'Alibaba',
      downloads: 0,
      tags: ['qwen', 'vision-language', 'multimodal', 'instruct'],
      frameworks: [],
      modelUrl: 'https://qwenlm.github.io',
      platforms: [],
      supportsInference: false,
      status: 'coming_soon',
      isDisabled: true,
      provider: 'qwen',
      comingSoonReason: 'Qwen API integration pending'
    }
  ]

  // Handle image processing completion
  const handleImageProcessed = useCallback((response: any) => {
    // Image processing completed
  }, [])


  const handleModelSelect = (model: ModelMetadata) => {
    setSelectedModel(model)
  }




  return (
    <div className="min-h-screen bg-wells-beige">
      {/* Luxury Header with Glassmorphism */}
      <header className="sticky top-0 z-50 glass-strong border-b border-wells-warm-grey/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <LidVizionIcon className="w-15 h-15" />
              <div>
                {/* <h1 className="text-lg font-serif font-semibold text-wells-dark-grey">Lid Vizion</h1> */}
                <p className="text-xs text-wells-warm-grey">Computer Vision Platform</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <a href="https://github.com/lidvizion/mobile-vision-app-starter" target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm flex items-center justify-center">
                  <Github className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Luxury Hero Section with Gradient Background */}
      <section className="relative py-20 bg-luxury-gradient border-b border-wells-warm-grey/20 overflow-hidden">
        {/* Floating Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-32 h-32 bg-wells-dark-grey/5 rounded-full animate-float"></div>
          <div className="absolute bottom-20 right-10 w-24 h-24 bg-wells-dark-grey/5 rounded-full animate-float" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-wells-dark-grey/5 rounded-full animate-float" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm text-wells-dark-grey rounded-xl text-sm font-medium mb-8 shadow-sm border border-wells-warm-grey/20">
            <Sparkles className="w-4 h-4" />
            <span>Cross-platform Computer Vision</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-serif font-bold text-wells-dark-grey mb-6 leading-tight">
            Deploy CV Apps <span className="text-wells-warm-grey">Faster Than Ever</span>
          </h1>

          <p className="text-lg text-wells-warm-grey max-w-2xl mx-auto mb-10 leading-relaxed">
            Professional Starter kit for computer vision apps, overlays, and scalable cloud infra.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://calendly.com/lidvizion-info/15" target="_blank" rel="noopener noreferrer" className="btn-primary btn-lg rounded-2xl hover-lift flex items-center gap-2">
              <span>Book a Call</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Main Content with Layered Cards */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Quick Test Section - Always visible */}
          {!showMoreModels && (
            <div className="space-y-8 animate-fade-in">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-wells-dark-grey mb-4">
                  Quick Model Comparison
                </h2>
                <p className="text-wells-warm-grey mb-6">
                  Test 3 models simultaneously on the same image
                </p>
              </div>

              {/* Task Type Selector */}
              <div className="flex items-center justify-center mb-6">
                <label className="text-sm font-medium text-wells-dark-grey mr-3">
                  Task Type:
                </label>
                <TaskTypeSelectDropdown
                  selectedTaskType={selectedTaskType as any}
                  onTaskTypeChange={(type) => {
                    // @ts-ignore
                    setSelectedTaskType(type);
                  }}
                />
              </div>

              {selectedTaskType === 'keypoint-detection' ? (
                <KeypointDetectionUI />
              ) : (
                <ParallelModelTester
                  featuredModels={featuredModels}
                  sharedImage={selectedImage}
                  onImageChange={setSelectedImage}
                  selectedTaskType={selectedTaskType}
                />
              )}

              {/* Browse All Models Button - Original Position */}
              <div className="text-center pt-8">
                <button
                  onClick={() => setShowMoreModels(true)}
                  className="btn-secondary btn-lg flex items-center gap-2 mx-auto hover-lift"
                >
                  <span>Browse All Models</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Existing Model Discovery Flow */}
          {showMoreModels && (
            <div className="space-y-8 animate-fade-in">
              <button
                onClick={() => setShowMoreModels(false)}
                className="btn-ghost mb-6 flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Quick Test</span>
              </button>

              {/* Existing GuidedModelFlow component */}
              {!selectedModel ? (
                <GuidedModelFlow onModelSelect={handleModelSelect} />
              ) : (
                <>
                  {/* Selected Model Info */}
                  <div className="card-floating p-4 animate-fade-in mb-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-wells-warm-grey mb-1">Selected Model</div>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const modelIdLower = selectedModel.id?.toLowerCase() || ''
                            let logoPath: string | null = null

                            if (modelIdLower.includes('gemini')) {
                              logoPath = '/icons/gemini-icon.svg'
                            } else if (modelIdLower.startsWith('google/')) {
                              logoPath = '/logos/google-gemini.png'
                            } else if (modelIdLower.startsWith('facebook/') || modelIdLower.startsWith('meta/')) {
                              logoPath = '/logos/meta-logo.png'
                            } else if (modelIdLower.startsWith('microsoft/')) {
                              logoPath = '/logos/microsoft.svg'
                            } else if (modelIdLower.startsWith('apple/')) {
                              logoPath = '/logos/meta-logo.png' // Fallback until Apple logo is added
                            }

                            return logoPath ? (
                              <Image
                                src={logoPath}
                                alt={selectedModel.author}
                                width={32}
                                height={32}
                                className="flex-shrink-0 object-contain"
                              />
                            ) : null
                          })()}
                          <div className="font-semibold text-wells-dark-grey">{selectedModel.name}</div>
                        </div>
                        <div className="text-sm text-wells-warm-grey">
                          {selectedModel.author || (selectedModel.id?.toLowerCase().includes('gemini') ? 'Google' : selectedModel.source)} • {selectedModel.task}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedModel(null)
                          router.push('/')
                        }}
                        className="px-4 py-2 text-sm border border-wells-warm-grey/30 rounded-lg hover:bg-wells-warm-grey/5"
                      >
                        Change Model
                      </button>
                    </div>
                  </div>


                  {/* Camera Preview - Visible After Model Selection */}
                  <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    <CameraPreview
                      currentTask={currentTask}
                      onImageProcessed={handleImageProcessed}
                      isProcessing={isProcessing}
                      processImage={processImage}
                      selectedImage={selectedImage}
                      setSelectedImage={setSelectedImage}
                      selectedModel={selectedModel}
                      onModelSelect={handleModelSelect}
                      availableModels={modelViewStore.modelList}
                      compressionInfo={compressionInfo}
                    />
                  </div>

                  {/* Results Display - Visible After Model Selection */}
                  <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
                    <ResultsDisplay
                      response={lastResponse}
                      selectedImage={selectedImage}
                      isProcessing={isProcessing}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Luxury Footer */}
      <footer className="border-t border-wells-warm-grey/20 bg-wells-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <LidVizionIcon className="w-30 h-30" />
            </div>
            <p className="text-wells-warm-grey text-sm mb-6 max-w-2xl mx-auto leading-relaxed">
              Cross-platform mobile starter kit for camera-based CV apps. Built with modern design principles and professional-grade components.
            </p>
            <div className="flex items-center justify-center gap-6 text-sm text-wells-warm-grey flex-wrap">
              <span>© 2025 Lid Vizion</span>
              <span>•</span>
              <a 
                href="https://www.lidvizion.ai/legal/privacy" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-wells-dark-grey transition-colors duration-200"
              >
                Privacy Policy
              </a>
              <span>•</span>
              <a 
                href="https://www.lidvizion.ai/legal/terms" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-wells-dark-grey transition-colors duration-200"
              >
                Terms & Conditions
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
