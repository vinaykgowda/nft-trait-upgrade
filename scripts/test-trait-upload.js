// Simple test script for trait upload functionality
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Trait Upload System...');

// Test file parsing
function testFileNameParsing() {
    console.log('\n📝 Testing file name parsing...');
    
    const testFiles = [
        'Clothes/Hoodie.png',
        'Background - Blue Sky.png',
        'Eyes_Green.png',
        'SimpleHat.png'
    ];
    
    testFiles.forEach(fileName => {
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
        let traitType = '';
        let value = '';
        
        if (nameWithoutExt.includes('/')) {
            [traitType, value] = nameWithoutExt.split('/');
        } else if (nameWithoutExt.includes(' - ')) {
            [traitType, value] = nameWithoutExt.split(' - ');
        } else if (nameWithoutExt.includes('_')) {
            [traitType, value] = nameWithoutExt.split('_');
        } else {
            traitType = 'Unknown';
            value = nameWithoutExt;
        }
        
        console.log(`  ${fileName} → Type: "${traitType.trim()}", Value: "${value.trim()}"`);
    });
}

// Test directory structure
function testDirectoryStructure() {
    console.log('\n📁 Testing directory structure...');
    
    const requiredDirs = [
        'public/trait-images',
        'public/trait-previews',
        'uploads/traits'
    ];
    
    requiredDirs.forEach(dir => {
        if (fs.existsSync(dir)) {
            console.log(`  ✅ ${dir} exists`);
        } else {
            console.log(`  ❌ ${dir} missing`);
        }
    });
}

// Run tests
testFileNameParsing();
testDirectoryStructure();

console.log('\n✅ Test completed!');
