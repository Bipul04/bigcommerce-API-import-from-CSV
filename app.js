const express = require('express');
const axios = require('axios');
const csv = require('csv-parser');
const fs = require('fs');

// You can use a library like cheerio to parse HTML and extract the "a" tag
const cheerio = require('cheerio');

const app = express();
const port = process.env.PORT || 3000;

const url = 'https://api.bigcommerce.com/stores/bohausxa6o/v2/blog/posts';

let options = {
  method: 'POST',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Auth-Token': '7qm72deb6wv6nluerx3rcls701rg3ky'
  }
};
const headers = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'X-Auth-Token': '90iph80fw7sgemjijz54frmydqql2gb',
};

app.get('/', (req, res) => {
  res.send('Welcome to my Node.js app!');
});

// Read data from the CSV file
app.get('/read-csv', (req, res) => {

  // Call the function to initiate the process
  sendPostRequestWithCsvData();
});

// Read data from the CSV file
app.get('/fetchBlogPosts', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  changeLinkInBlogPost(res);
});

// Function to read CSV file and send POST request
function sendPostRequestWithCsvData() {
  const jsonData = [];

  fs.createReadStream('data.csv')
    .pipe(csv())
    .on('data', (row) => {
      // Assuming CSV file has columns like title, url, body, etc.
      // Adjust these keys according to your CSV structure
      jsonData.push({
        title: row.NAME,
        body: row.CONTENT,
        tags: row.TAGS.split(','), // Convert tags to an array
        is_published: true, // Convert is_published to a boolean
        meta_description: row['META DESCRIPTION'],
        meta_keywords: row['META KEYWORDS']
      });
    })
    .on('end', () => {
      jsonData.forEach(item => {
        fetch(url, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(item),
        })
          .then((res) => res.json())
          .then((responseJson) => console.log('POST Response:', responseJson))
          .catch((err) => console.error('POST Error:', err));
      });
    });
}
function dateFunction(dateInput) {
  // Input date string
  let inputDateStr = dateInput;

  // Create a Date object from the input date string
  let inputDate = new Date(inputDateStr);

  // Add one day to the inputDate
  inputDate.setDate(inputDate.getDate() + 1);

  // Format the updated Date object into RFC-2822 format
  let rfc2822Date = inputDate.toUTCString();

  console.log(rfc2822Date);

  return rfc2822Date;
}

// function dateFunction(dateInput) {
//   // Input date string
//   let inputDateStr = dateInput;

//   // Create a Date object from the input date string
//   let inputDate = new Date(inputDateStr);

//   // Format the Date object into RFC-2822 format
//   let rfc2822Date = inputDate.toUTCString();

//   console.log(rfc2822Date);


//   return rfc2822Date;

// }
// Function to add leading zero to a number if it's less than 10
function addLeadingZero(number) {
  return number < 10 ? "0" + number : number;
}

// Function to change blog lik to relative link
function changeLinkInBlogPost(res) {
  fetch(url, {
    method: 'GET',
    headers: headers,
  })
    .then((apiResponse) => apiResponse.json())
    .then((responseJson) => {
       // Assuming responseJson is an array of blog posts
       responseJson.forEach((post) => {
        // Replace links in the body
        const { updatedBody, linkReplaced } = replaceLinks(post.body);

        if (linkReplaced) {
          hitPutRequest(post.id, post);

        } 
      });

      res.end(); // Finish the response
    })
    .catch((err) => {
      console.error('POST Error:', err);
      res.status(500).send('Internal Server Error');
    });
}

function extractLinksFromBlogPost(body) {
  const $ = cheerio.load(body);
  const links = $('a').map((index, element) => $(element).attr('href')).get();
  return links;
}

function hitPutRequest(id, originalPost) {
  var putUrl = `https://api.bigcommerce.com/stores/bohausxa6o/v2/blog/posts/${id}`;
  const { body, is_published, published_date } = originalPost;

  const updatedPost = {
    body: replaceLinks(body).updatedBody,
    is_published: is_published,
    published_date: dateFunction(published_date.date),
  };

  fetch(putUrl, {
    method: 'PUT',
    headers: headers,
    body: JSON.stringify(updatedPost),
  })
    .then((putResponse) => {
      if (!putResponse.ok) {
        throw new Error(`HTTP error! Status: ${putResponse.status}`);
      }
      return putResponse.json();
    })
    .then((putResponseJson) => {
      console.log('PUT Response:', putResponseJson);
    })
    .catch((err) => console.error('PUT Error:', err.message));
}

function replaceLinks(body) {
  const $ = cheerio.load(body);
  let linkReplaced = false;

  // Replace links in the body
  $('a').each((index, element) => {
    const href = $(element).attr('href');
    if (href.includes('https://usdieselparts.com/')) {
      // If the link contains the specified base URL, replace it accordingly
      const newPath = href.replace('https://usdieselparts.com/', '/');
      $(element).attr('href', newPath);
      linkReplaced = true;
    } else if (href === 'https://usdieselparts.com' || href === 'https://usdieselparts.com/') {
      $(element).attr('href', '/');
      linkReplaced = true;
    }
  });

  return { updatedBody: $.html(), linkReplaced };
}

async function fetchData() {
  try {
    const response = await axios.get(url, { headers });
    const posts = response.data;

    // Assuming you want to get the "a" tag from the body of the first post
    // const firstPostBody = posts[0].body;
    // const $ = cheerio.load(firstPostBody);

    // Assuming the "a" tag is present in the first paragraph of the body
    // const firstATag = $('p').first().find('a').html();
    // Send the response to the browser
    return response;
    console.log('The "a" tag content:', response.data);
  } catch (error) {
    console.error('Error fetching data:', error.message);
    return error;
  }
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
